import { useEffect, useState } from "react";
import "./App.css";
import Navigation from "./components/Navigation";
import Summary from "./views/Summary";
import Movements from "./views/Movements";
import Statistics from "./views/Statistics";
import Investments from "./views/Investments";
import {
  fetchAllDashboardData,
  patchTransactionCategory,
  postAuthorizeBank,
  postSync,
} from "./api";

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.29 20.29 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20.29 20.29 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

const VIEW_TITLES = {
  summary: "Resumen",
  movements: "Movimientos",
  statistics: "Estadísticas",
  investments: "Inversiones",
};

const describeSyncResult = (syncResponse) => {
  if (!syncResponse) return null;

  if (syncResponse.status === "cooldown") {
    const minutes = Math.max(
      1,
      Math.ceil((syncResponse.retry_after_seconds || 0) / 60)
    );

    return {
      tone: "info",
      message: `Ya se sincronizó hace poco. Podrás volver a actualizar en ${minutes} min.`,
      banksNeedingReauth: [],
    };
  }

  const results = syncResponse.results || [];

  const banksWith = (status) => [
    ...new Set(
      results
        .filter((r) => r.transactions === status || r.balance === status)
        .map((r) => r.bank)
    ),
  ];

  const closedSessionBanks = banksWith("closed_session");
  const rateLimitedBanks = banksWith("rate_limited");

  if (syncResponse.status === "success") {
    return {
      tone: "success",
      message: "Datos actualizados.",
      banksNeedingReauth: [],
    };
  }

  const messages = [];

  if (closedSessionBanks.length > 0) {
    messages.push(
      `${closedSessionBanks.join(", ")} necesita volver a conectarse.`
    );
  }

  if (rateLimitedBanks.length > 0) {
    messages.push(
      `Límite temporal de ${rateLimitedBanks.join(
        ", "
      )} alcanzado. Se muestran los últimos datos disponibles.`
    );
  }

  if (messages.length === 0) {
    messages.push("Algunas cuentas no pudieron actualizarse.");
  }

  return {
    tone: syncResponse.status === "failed" ? "error" : "warning",
    message: messages.join(" "),
    banksNeedingReauth: closedSessionBanks,
  };
};

function App() {
  const [activeView, setActiveView] = useState("summary");
  const [pendingCategoryFilter, setPendingCategoryFilter] = useState(null);
  const [reviewToken, setReviewToken] = useState(0);

  const [dashboard, setDashboard] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [privacyMode, setPrivacyMode] = useState(
    () => localStorage.getItem("privacyMode") === "true"
  );

  useEffect(() => {
    localStorage.setItem("privacyMode", privacyMode);
  }, [privacyMode]);

  useEffect(() => {
    fetchAllDashboardData()
      .then((data) => {
        setDashboard(data.dashboard);
        setAccounts(data.accounts);
        setTransactions(data.transactions);
        setCategories(data.categories);
        setStats(data.stats);
      })
      .catch((error) => console.error(error));
  }, []);

  const handleSync = async () => {
    if (isSyncing) return;

    setIsSyncing(true);

    try {
      const syncData = await postSync();
      const refreshed = await fetchAllDashboardData();

      setDashboard(refreshed.dashboard);
      setAccounts(refreshed.accounts);
      setTransactions(refreshed.transactions);
      setStats(refreshed.stats);
      setSyncResult(describeSyncResult(syncData));
    } catch (error) {
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReconnect = async (bank) => {
    try {
      const data = await postAuthorizeBank(bank);

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleCategoryChange = async (transactionId, category, applyToSimilar) => {
    try {
      await patchTransactionCategory(transactionId, category, applyToSimilar);
      const transactionsResponse = await fetchAllDashboardData();
      setTransactions(transactionsResponse.transactions);
      setStats(transactionsResponse.stats);
    } catch (error) {
      console.error("No se pudo actualizar la categoría", error);
    }
  };

  const handleNavigate = (viewId) => {
    setActiveView(viewId);
  };

  // Movimientos ya no se desmonta al navegar (sus filtros viven en su
  // propio estado y persisten durante la sesión); reviewToken es la señal
  // para "vuelve a aplicar Sin clasificar ahora", incluso si ya estaba
  // montado con otros filtros.
  const handleReviewPending = () => {
    setPendingCategoryFilter("Sin clasificar");
    setReviewToken((token) => token + 1);
    setActiveView("movements");
  };

  const getLastUpdatedText = () => {
    const dates = accounts
      .map((account) => account.balance_updated_at)
      .filter(Boolean)
      .map((date) => new Date(date));

    if (dates.length === 0) {
      return "sin sincronizar todavía";
    }

    const latestDate = new Date(
      Math.max(...dates.map((date) => date.getTime()))
    );

    const diffMs = Date.now() - latestDate.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return "hace menos de 1 min";
    if (diffMinutes === 1) return "hace 1 min";
    if (diffMinutes < 60) return `hace ${diffMinutes} min`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return "hace 1 h";

    return `hace ${diffHours} h`;
  };

  if (!dashboard) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Personal Finance</p>
          <h1>{VIEW_TITLES[activeView] || "Dashboard"}</h1>
        </div>

        <div className="topbar-actions">
          <button
            className={`privacy-toggle${privacyMode ? " active" : ""}`}
            onClick={() => setPrivacyMode((prev) => !prev)}
            aria-pressed={privacyMode}
            title={
              privacyMode ? "Mostrar importes" : "Ocultar importes sensibles"
            }
          >
            {privacyMode ? <EyeOffIcon /> : <EyeIcon />}
            {privacyMode ? "Oculto" : "Privacidad"}
          </button>

          <button
            className="sync-button"
            onClick={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </header>

      <Navigation activeView={activeView} onChange={handleNavigate} />

      <main className="dashboard">
        {/* Las 4 vistas quedan siempre montadas (visibilidad por CSS) para
            que Movimientos conserve sus filtros al navegar fuera y volver,
            durante la sesión actual (sin localStorage). */}
        <div hidden={activeView !== "summary"}>
          <Summary
            dashboard={dashboard}
            accounts={accounts}
            transactions={transactions}
            stats={stats}
            privacyMode={privacyMode}
            syncResult={syncResult}
            onReconnect={handleReconnect}
            lastUpdatedText={getLastUpdatedText()}
            onReviewPending={handleReviewPending}
          />
        </div>

        <div hidden={activeView !== "movements"}>
          <Movements
            transactions={transactions}
            categories={categories}
            accounts={accounts}
            privacyMode={privacyMode}
            onCategoryChange={handleCategoryChange}
            initialCategoryFilter={pendingCategoryFilter}
            reviewToken={reviewToken}
          />
        </div>

        <div hidden={activeView !== "statistics"}>
          <Statistics stats={stats} privacyMode={privacyMode} />
        </div>

        <div hidden={activeView !== "investments"}>
          <Investments />
        </div>
      </main>
    </div>
  );
}

export default App;
