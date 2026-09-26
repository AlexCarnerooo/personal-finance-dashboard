import { useEffect, useState } from "react";
import "./App.css";

const MASKED_VALUE = "•••••• €";

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

const formatDate = (dateString) => {
  if (!dateString) return "—";

  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatAmount = (amount, currency) => {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
    signDisplay: "exceptZero",
  }).format(amount);
};

const getMovementName = (transaction) =>
  transaction.merchant || transaction.description || "Movimiento";

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
  const [dashboard, setDashboard] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [applyToSimilarByRow, setApplyToSimilarByRow] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [privacyMode, setPrivacyMode] = useState(
    () => localStorage.getItem("privacyMode") === "true"
  );

  useEffect(() => {
    localStorage.setItem("privacyMode", privacyMode);
  }, [privacyMode]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/dashboard")
      .then((response) => response.json())
      .then((data) => setDashboard(data))
      .catch((error) => console.error(error));

    fetch("http://127.0.0.1:8000/api/accounts")
      .then((response) => response.json())
      .then((data) => setAccounts(data))
      .catch((error) => console.error(error));

    fetch("http://127.0.0.1:8000/api/transactions")
      .then((response) => response.json())
      .then((data) => setTransactions(data))
      .catch((error) => console.error(error));

    fetch("http://127.0.0.1:8000/api/categories")
      .then((response) => response.json())
      .then((data) => setCategories(data))
      .catch((error) => console.error(error));
  }, []);

  const handleCategoryChange = async (transactionId, category) => {
    const applyToSimilar = Boolean(applyToSimilarByRow[transactionId]);

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/transactions/${transactionId}/category`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, apply_to_similar: applyToSimilar }),
        }
      );

      if (!response.ok) {
        console.error("No se pudo actualizar la categoría", await response.text());
        return;
      }

      const transactionsResponse = await fetch(
        "http://127.0.0.1:8000/api/transactions"
      );
      const transactionsData = await transactionsResponse.json();
      setTransactions(transactionsData);

      setApplyToSimilarByRow((prev) => ({ ...prev, [transactionId]: false }));
    } catch (error) {
      console.error(error);
    }
  };


  const handleSync = async () => {
    if (isSyncing) return;

    setIsSyncing(true);

    try {
      const syncResponse = await fetch("http://127.0.0.1:8000/api/sync", {
        method: "POST",
      });
      const syncData = await syncResponse.json();

      const dashboardResponse = await fetch(
        "http://127.0.0.1:8000/api/dashboard"
      );
      const dashboardData = await dashboardResponse.json();

      const accountsResponse = await fetch(
        "http://127.0.0.1:8000/api/accounts"
      );
      const accountsData = await accountsResponse.json();

      const transactionsResponse = await fetch(
        "http://127.0.0.1:8000/api/transactions"
      );
      const transactionsData = await transactionsResponse.json();

      setDashboard(dashboardData);
      setAccounts(accountsData);
      setTransactions(transactionsData);
      setSyncResult(describeSyncResult(syncData));
    } catch (error) {
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReconnect = async (bank) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/banks/${encodeURIComponent(bank)}/authorize`,
        { method: "POST" }
      );
      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error(error);
    }
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

    if (diffMinutes < 1) {
      return "hace menos de 1 min";
    }

    if (diffMinutes === 1) {
      return "hace 1 min";
    }

    if (diffMinutes < 60) {
      return `hace ${diffMinutes} min`;
    }

    const diffHours = Math.floor(diffMinutes / 60);

    if (diffHours === 1) {
      return "hace 1 h";
    }

    return `hace ${diffHours} h`;
  };

  if (!dashboard) {
    return <div className="loading">Cargando...</div>;
  }

  const hasAnyBalance = accounts.some(
    (account) => account.balance !== null
  );

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Personal Finance</p>
          <h1>Dashboard</h1>
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

      <main className="dashboard">
        <section className="hero-card">
          
          <p>Patrimonio disponible</p>

          <h2>
            {privacyMode
              ? MASKED_VALUE
              : hasAnyBalance
              ? `${dashboard.total_balance_eur.toFixed(2)} €`
              : "— €"}
          </h2>
          <span>Última actualización correcta: {getLastUpdatedText()}</span>

          {!hasAnyBalance && (
            <span>Saldo pendiente de sincronizar</span>

          )}

          {syncResult && syncResult.tone !== "success" && (
            <div className="sync-alert">
              <span>⚠ Último intento: {syncResult.message}</span>

              {syncResult.banksNeedingReauth.map((bank) => (
                <button
                  key={bank}
                  type="button"
                  className="reconnect-button"
                  onClick={() => handleReconnect(bank)}
                >
                  Reconectar {bank}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="metrics-grid">
          <div className="metric-card">
            <p>Ingresos</p>
            <strong className="positive">
              {privacyMode
                ? MASKED_VALUE
                : `+${dashboard.monthly_income.toFixed(2)} €`}
            </strong>
            <span>Este mes</span>
          </div>

          <div className="metric-card">
            <p>Gastos</p>
            <strong className="negative">
              -{dashboard.monthly_expenses.toFixed(2)} €
            </strong>
            <span>Este mes</span>
          </div>

          <div className="metric-card">
            <p>Balance mensual</p>
            <strong
              className={
                dashboard.monthly_net >= 0
                  ? "positive"
                  : "negative"
              }
            >
              {privacyMode
                ? MASKED_VALUE
                : `${dashboard.monthly_net.toFixed(2)} €`}
            </strong>
            <span>Ingresos − gastos</span>
          </div>
        </section>

        <section>
          <div className="section-header">
            <div>
              <p className="eyebrow">Cuentas</p>
              <h2>Mis cuentas</h2>
            </div>
          </div>

          <div className="accounts-grid">
            {accounts
              .filter((account) => account.currency !== "HUF")
              .map((account) => (
              <article className="account-card" key={account.id}>
                <div className="account-top">
                  <strong>{account.bank}</strong>
                  <span>{account.currency}</span>
                </div>

                <div className="account-balance">
                  {privacyMode
                    ? MASKED_VALUE
                    : account.balance !== null
                    ? `${account.balance.toFixed(2)} ${account.currency}`
                    : "—"}
                </div>

                <p>
                  {account.balance_updated_at
                    ? "Saldo sincronizado"
                    : "Pendiente de sincronizar"}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="transactions-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Actividad</p>
              <h2>Movimientos</h2>
            </div>
          </div>

          <div className="transactions-card">
            {transactions.length === 0 && (
              <p className="empty-state">Sin movimientos todavía.</p>
            )}

            {transactions.map((transaction) => (
              <div className="transaction-row" key={transaction.id}>
                <div>
                  <strong>
                    {getMovementName(transaction)}
                    {transaction.is_bizum && (
                      <span className="bizum-tag">Bizum</span>
                    )}
                  </strong>

                  <span className="transaction-meta">
                    {formatDate(transaction.date)}
                    {" · "}
                    {transaction.flow_type === "internal_transfer" ? (
                      "Transferencia interna"
                    ) : (
                      <span className="category-control">
                        <select
                          value={transaction.category || ""}
                          onChange={(event) =>
                            handleCategoryChange(
                              transaction.id,
                              event.target.value
                            )
                          }
                        >
                          {categories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>

                        <label className="apply-similar-label">
                          <input
                            type="checkbox"
                            checked={Boolean(
                              applyToSimilarByRow[transaction.id]
                            )}
                            onChange={(event) =>
                              setApplyToSimilarByRow((prev) => ({
                                ...prev,
                                [transaction.id]: event.target.checked,
                              }))
                            }
                          />
                          Aplicar también a movimientos similares
                        </label>
                      </span>
                    )}
                  </span>
                </div>

                <strong
                  className={
                    transaction.amount >= 0 ? "positive" : "negative"
                  }
                >
                  {formatAmount(transaction.amount, transaction.currency)}
                </strong>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;