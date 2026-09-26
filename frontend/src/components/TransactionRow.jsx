import { useState } from "react";
import { formatDate, formatAmount, getMovementName } from "../utils/format";

// Fila de movimiento compartida entre Resumen (editable=false) y
// Movimientos (editable=true). El nombre SIEMPRE pasa por
// getMovementName(transaction, privacyMode): es el único sitio de toda la
// app que decide si se enmascara/reescribe la identidad de un movimiento
// (Bizum, transferencias internas...). Esta función no se toca aquí.
//
// Resumen y Movimientos necesitan formas distintas (bloque de 2 líneas vs.
// grid de 3 zonas), así que la fila se renderiza de forma distinta según
// `editable` en vez de forzar una única estructura para ambos casos.
function TransactionRow({
  transaction,
  privacyMode,
  categories,
  editable = false,
  onCategoryChange,
}) {
  const [applyToSimilar, setApplyToSimilar] = useState(false);

  const isInternalTransfer = transaction.flow_type === "internal_transfer";
  const name = getMovementName(transaction, privacyMode);

  const nameBlock = (
    <strong className="transaction-name-text">
      {name}
      {transaction.is_bizum && <span className="bizum-tag">Bizum</span>}
    </strong>
  );

  const amountBlock = (
    <strong
      className={`transaction-amount ${
        transaction.amount >= 0 ? "positive" : "negative"
      }`}
    >
      {formatAmount(transaction.amount, transaction.currency)}
    </strong>
  );

  if (!editable) {
    return (
      <div className="transaction-row transaction-row-compact">
        <div className="transaction-row-top">
          {nameBlock}
          {amountBlock}
        </div>

        <div className="transaction-meta">
          {formatDate(transaction.date)} ·{" "}
          {isInternalTransfer
            ? "Transferencia interna"
            : transaction.category || "Sin clasificar"}
        </div>
      </div>
    );
  }

  return (
    <div className="transaction-row transaction-row-editable">
      <div className="transaction-left">
        {nameBlock}

        <div className="transaction-meta">
          {formatDate(transaction.date)}
          {transaction.bank ? ` · ${transaction.bank}` : ""}
        </div>
      </div>

      <div className="transaction-category">
        {isInternalTransfer ? (
          <span className="category-badge category-badge-muted">
            Transferencia interna
          </span>
        ) : (
          <span className="category-control">
            <select
              value={transaction.category || ""}
              onChange={(event) => {
                onCategoryChange(
                  transaction.id,
                  event.target.value,
                  applyToSimilar
                );
                setApplyToSimilar(false);
              }}
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
                checked={applyToSimilar}
                onChange={(event) => setApplyToSimilar(event.target.checked)}
              />
              Aplicar a similares
            </label>
          </span>
        )}
      </div>

      {amountBlock}
    </div>
  );
}

export default TransactionRow;
