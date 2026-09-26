import Amount from "../components/Amount";
import MetricCard from "../components/MetricCard";
import CategoryBarChart from "../components/CategoryBarChart";
import { formatPlainAmount } from "../utils/format";

function MerchantList({ title, rows, privacyMode, valueKey }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2>{title}</h2>
      </div>

      <div className="merchant-list">
        {rows.length === 0 && (
          <p className="empty-state">Sin datos suficientes todavía.</p>
        )}

        {rows.map((row) => (
          <div className="merchant-row" key={row.name}>
            <span>{row.name}</span>
            <span className="merchant-row-value">
              {valueKey === "count"
                ? `${row.count} mov.`
                : privacyMode
                ? "•••• €"
                : formatPlainAmount(row.amount, "EUR")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Statistics({ stats, privacyMode }) {
  if (!stats) {
    return <p className="empty-state">Cargando estadísticas…</p>;
  }

  return (
    <div className="view-statistics">
      <p className="period-note">
        Periodo disponible: {stats.period_start} → {stats.period_end}
      </p>

      <section className="metrics-grid metrics-grid-3">
        <MetricCard
          label="Ingresos del periodo"
          value={stats.total_income}
          tone="positive"
          privacyMode={privacyMode}
          sign
        />
        <MetricCard
          label="Gastos del periodo"
          value={-stats.total_expense}
          tone="negative"
          privacyMode={privacyMode}
          sign
        />
        {/* No es un importe: no pasa por Amount/privacyMode a propósito. */}
        <div className="metric-card">
          <p>Sin clasificar</p>
          <strong>{stats.uncategorized_count}</strong>
          <span>movimientos pendientes</span>
        </div>
      </section>

      <section className="card chart-card">
        <div className="card-header">
          <h2>Gasto por categoría</h2>
        </div>
        <CategoryBarChart data={stats.category_breakdown} privacyMode={privacyMode} />
      </section>

      <section className="two-column">
        <MerchantList
          title="Principales comercios por gasto"
          rows={stats.top_merchants_by_amount}
          privacyMode={privacyMode}
          valueKey="amount"
        />
        <MerchantList
          title="Principales comercios por frecuencia"
          rows={stats.top_merchants_by_frequency}
          privacyMode={privacyMode}
          valueKey="count"
        />
      </section>

      <section className="two-column">
        <div className="card">
          <div className="card-header">
            <h2>Bizum enviados</h2>
          </div>
          <p className="bizum-stat">
            <strong>{stats.bizum_sent.count}</strong> movimientos ·{" "}
            <Amount
              value={-stats.bizum_sent.amount}
              privacyMode={privacyMode}
              sign
            />
          </p>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Bizum recibidos</h2>
          </div>
          <p className="bizum-stat">
            <strong>{stats.bizum_received.count}</strong> movimientos ·{" "}
            <Amount
              value={stats.bizum_received.amount}
              privacyMode={privacyMode}
              sign
            />
          </p>
        </div>
      </section>
    </div>
  );
}

export default Statistics;
