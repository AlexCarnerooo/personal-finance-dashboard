import { formatPlainAmount } from "../utils/format";

// Barras horizontales de gasto por categoría. La longitud de la barra
// (proporción relativa entre categorías) se mantiene siempre visible: por
// sí sola no permite leer una cifra exacta. Solo la etiqueta numérica al
// final de la barra se enmascara con Privacy Mode.
function CategoryBarChart({ data, privacyMode }) {
  if (!data || data.length === 0) {
    return <p className="empty-state">Todavía no hay gasto categorizado.</p>;
  }

  const maxAmount = Math.max(...data.map((row) => row.amount));

  return (
    <div className="bar-chart">
      {data.map((row) => (
        <div className="bar-chart-row" key={row.category}>
          <span className="bar-chart-label">{row.category}</span>

          <div className="bar-chart-track">
            <div
              className="bar-chart-fill"
              style={{ width: `${(row.amount / maxAmount) * 100}%` }}
            />
          </div>

          <span className="bar-chart-value">
            {privacyMode ? "•••• €" : formatPlainAmount(row.amount, "EUR")}
          </span>
        </div>
      ))}
    </div>
  );
}

export default CategoryBarChart;
