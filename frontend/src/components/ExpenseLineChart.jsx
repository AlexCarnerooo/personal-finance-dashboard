import { useState } from "react";
import { formatTickDate, formatShortDate, formatPlainAmount } from "../utils/format";

const WIDTH = 640;
const HEIGHT = 220;
const PADDING_LEFT = 44;
const PADDING_RIGHT = 12;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 28;
const X_TICK_COUNT = 5;

// Índices de data distribuidos uniformemente (siempre incluye el primero y
// el último), calculados a partir de la longitud real de los datos — nunca
// fechas fijas.
const computeTickIndices = (length) => {
  const tickCount = Math.min(X_TICK_COUNT, length);
  const indices = new Set();

  for (let i = 0; i < tickCount; i++) {
    const index = Math.round((i * (length - 1)) / Math.max(1, tickCount - 1));
    indices.add(index);
  }

  return indices;
};

// Gráfica de evolución del gasto diario. Privacy Mode oculta las etiquetas
// numéricas del eje Y y del tooltip (nunca los datos en sí, que siguen
// siendo reales): la forma de la línea se conserva porque, por sí sola, no
// permite leer una cifra exacta.
function ExpenseLineChart({ data, privacyMode }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!data || data.length === 0) {
    return <p className="empty-state">Sin histórico suficiente todavía.</p>;
  }

  const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const maxAmount = Math.max(1, ...data.map((point) => point.amount));

  const xFor = (index) =>
    PADDING_LEFT +
    (data.length === 1 ? 0 : (index / (data.length - 1)) * plotWidth);

  const yFor = (amount) =>
    PADDING_TOP + plotHeight - (amount / maxAmount) * plotHeight;

  const linePoints = data.map((point, index) => [xFor(index), yFor(point.amount)]);

  const linePath = linePoints
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`)
    .join(" ");

  const areaPath =
    `${linePath} L${xFor(data.length - 1)},${PADDING_TOP + plotHeight} ` +
    `L${xFor(0)},${PADDING_TOP + plotHeight} Z`;

  const yTicks = [0, 0.5, 1].map((fraction) => ({
    value: maxAmount * fraction,
    y: PADDING_TOP + plotHeight - fraction * plotHeight,
  }));

  const handleMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const ratio = Math.min(
      1,
      Math.max(0, (relativeX - PADDING_LEFT) / plotWidth)
    );
    const index = Math.round(ratio * (data.length - 1));
    setHoverIndex(index);
  };

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const tickIndices = computeTickIndices(data.length);

  return (
    <div className="chart-wrapper">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="chart-svg"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={PADDING_LEFT}
              x2={WIDTH - PADDING_RIGHT}
              y1={tick.y}
              y2={tick.y}
              className="chart-gridline"
            />
            {!privacyMode && (
              <text x={4} y={tick.y + 4} className="chart-axis-label">
                {formatPlainAmount(tick.value, "EUR")}
              </text>
            )}
          </g>
        ))}

        <path d={areaPath} className="chart-area" />
        <path d={linePath} className="chart-line" />

        {data.map((point, index) => (
          <text
            key={point.date}
            x={xFor(index)}
            y={HEIGHT - 6}
            className="chart-axis-label chart-axis-label-x"
            textAnchor="middle"
            opacity={tickIndices.has(index) || index === hoverIndex ? 1 : 0}
          >
            {formatTickDate(point.date)}
          </text>
        ))}

        {hovered && (
          <line
            x1={xFor(hoverIndex)}
            x2={xFor(hoverIndex)}
            y1={PADDING_TOP}
            y2={PADDING_TOP + plotHeight}
            className="chart-hover-line"
          />
        )}
      </svg>

      {hovered && (
        <div className="chart-tooltip">
          <strong>{formatShortDate(hovered.date)}</strong>
          <span>
            {privacyMode ? "•••• €" : formatPlainAmount(hovered.amount, "EUR")}
          </span>
        </div>
      )}
    </div>
  );
}

export default ExpenseLineChart;
