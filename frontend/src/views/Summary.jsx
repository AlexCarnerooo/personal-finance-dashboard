import MetricCard from "../components/MetricCard";
import AccountCard from "../components/AccountCard";
import TransactionRow from "../components/TransactionRow";
import SyncStatus from "../components/SyncStatus";
import ExpenseLineChart from "../components/ExpenseLineChart";
import CategoryBarChart from "../components/CategoryBarChart";

function Summary({
  dashboard,
  accounts,
  transactions,
  stats,
  privacyMode,
  syncResult,
  onReconnect,
  lastUpdatedText,
  onReviewPending,
}) {
  const hasAnyBalance = accounts.some((account) => account.balance !== null);

  const pendingCount = transactions.filter(
    (tx) => tx.flow_type !== "internal_transfer" && tx.category === "Sin clasificar"
  ).length;

  const recentTransactions = transactions.slice(0, 7);

  const visibleAccounts = accounts.filter(
    (account) => account.currency !== "HUF"
  );

  const topCategories = (stats?.category_breakdown || []).slice(0, 6);

  return (
    <div className="view-summary">
      <section className="metrics-grid metrics-grid-4">
        <MetricCard
          label="Patrimonio disponible"
          value={hasAnyBalance ? dashboard.total_balance_eur : null}
          privacyMode={privacyMode}
          sublabel={`Última actualización correcta: ${lastUpdatedText}`}
        />
        <MetricCard
          label="Ingresos"
          value={dashboard.monthly_income}
          tone="positive"
          privacyMode={privacyMode}
          sublabel="Este mes"
          sign
        />
        <MetricCard
          label="Gastos"
          value={-dashboard.monthly_expenses}
          tone="negative"
          privacyMode={privacyMode}
          sublabel="Este mes"
          sign
        />
        <MetricCard
          label="Balance"
          value={dashboard.monthly_net}
          tone={dashboard.monthly_net >= 0 ? "positive" : "negative"}
          privacyMode={privacyMode}
          sublabel="Ingresos − gastos"
          sign
        />
      </section>

      <SyncStatus syncResult={syncResult} onReconnect={onReconnect} />

      <section className="charts-grid">
        <div className="card chart-card">
          <div className="card-header">
            <h2>Evolución del gasto</h2>
            <span className="card-subtitle">
              {stats?.period_start && stats?.period_end
                ? `${stats.period_start} → ${stats.period_end}`
                : ""}
            </span>
          </div>
          <ExpenseLineChart
            data={stats?.expense_daily || []}
            privacyMode={privacyMode}
          />
        </div>

        <div className="card chart-card">
          <div className="card-header">
            <h2>Gasto por categoría</h2>
          </div>
          <CategoryBarChart data={topCategories} privacyMode={privacyMode} />
        </div>
      </section>

      {pendingCount > 0 && (
        <section className="card pending-banner">
          <span>
            <strong>{pendingCount}</strong> movimientos pendientes de
            categorizar
          </span>
          <button type="button" className="link-button" onClick={onReviewPending}>
            Revisar
          </button>
        </section>
      )}

      <section className="two-column">
        <div className="card">
          <div className="card-header">
            <h2>Últimos movimientos</h2>
          </div>

          <div className="transactions-list transactions-list-compact">
            {recentTransactions.length === 0 && (
              <p className="empty-state">Sin movimientos todavía.</p>
            )}

            {recentTransactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                privacyMode={privacyMode}
                editable={false}
              />
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Cuentas</h2>
          </div>

          <div className="accounts-list">
            {visibleAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                privacyMode={privacyMode}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Summary;
