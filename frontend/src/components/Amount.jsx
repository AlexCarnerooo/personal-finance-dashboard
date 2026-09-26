import { MASKED_VALUE, formatAmount } from "../utils/format";

// Único punto que decide si un importe AGREGADO (patrimonio, saldo de
// cuenta, ingresos/gastos/balance, totales de estadísticas) se enmascara.
// Los importes de transacciones individuales NUNCA pasan por aquí: esos
// siempre se muestran, con o sin Privacy Mode.
function Amount({ value, currency = "EUR", privacyMode, sign = false }) {
  if (privacyMode) {
    return <>{MASKED_VALUE}</>;
  }

  if (value === null || value === undefined) {
    return <>—</>;
  }

  if (sign) {
    return <>{formatAmount(value, currency)}</>;
  }

  return (
    <>
      {new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency,
      }).format(value)}
    </>
  );
}

export default Amount;
