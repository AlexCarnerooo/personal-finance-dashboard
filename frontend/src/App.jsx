import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [dashboard, setDashboard] = useState(null);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/dashboard")
      .then((response) => response.json())
      .then((data) => setDashboard(data))
      .catch((error) => console.error(error));

    fetch("http://127.0.0.1:8000/api/accounts")
      .then((response) => response.json())
      .then((data) => setAccounts(data))
      .catch((error) => console.error(error));
  }, []);

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

        <button className="sync-button">
          Actualizar
        </button>
      </header>

      <main className="dashboard">
        <section className="hero-card">
          <p>Patrimonio disponible</p>

          <h2>
            {hasAnyBalance
              ? `${dashboard.total_balance_eur.toFixed(2)} €`
              : "— €"}
          </h2>

          {!hasAnyBalance && (
            <span>Saldo pendiente de sincronizar</span>
          )}
        </section>

        <section className="metrics-grid">
          <div className="metric-card">
            <p>Ingresos</p>
            <strong className="positive">
              +{dashboard.monthly_income.toFixed(2)} €
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
              {dashboard.monthly_net.toFixed(2)} €
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
            {accounts.map((account) => (
              <article className="account-card" key={account.id}>
                <div className="account-top">
                  <strong>{account.bank}</strong>
                  <span>{account.currency}</span>
                </div>

                <div className="account-balance">
                  {account.balance !== null
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
              <h2>Últimos movimientos</h2>
            </div>
          </div>

          <div className="transactions-card">
            {dashboard.recent_transactions.map(
              (transaction, index) => (
                <div className="transaction-row" key={index}>
                  <div>
                    <strong>
                      {transaction.merchant || "Sin nombre"}
                    </strong>
                    <span>
                      {transaction.type || "Movimiento"}
                    </span>
                  </div>

                  <strong
                    className={
                      transaction.amount >= 0
                        ? "positive"
                        : "negative"
                    }
                  >
                    {transaction.amount > 0 ? "+" : ""}
                    {transaction.amount.toFixed(2)}{" "}
                    {transaction.currency}
                  </strong>
                </div>
              )
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;