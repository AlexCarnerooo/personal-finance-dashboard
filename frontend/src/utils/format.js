export const MASKED_VALUE = "•••••• €";
export const BIZUM_PRIVACY_PLACEHOLDER = "Bizum · ••••••••";

export const formatDate = (dateString) => {
  if (!dateString) return "—";

  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const formatShortDate = (dateString) => {
  if (!dateString) return "—";

  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
  });
};

export const formatAmount = (amount, currency) => {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
    signDisplay: "exceptZero",
  }).format(amount);
};

export const formatPlainAmount = (amount, currency) => {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
  }).format(amount);
};

const MONTHS_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

// Formato compacto para ejes de gráfica ("8 ago"), calculado siempre a
// partir de la fecha real del dato — nunca fechas fijas.
export const formatTickDate = (dateString) => {
  if (!dateString) return "";

  const date = new Date(dateString);
  return `${date.getUTCDate()} ${MONTHS_ES[date.getUTCMonth()]}`;
};

// Un Bizum cuyo único identificador disponible es un número de teléfono
// (p. ej. "Bizum payment from: +34600000000", sin merchant_name guardado)
// no aporta nada como nombre y expone un dato personal igualmente. Si el
// Bizum SÍ tiene un nombre humano (merchant_name presente, o un texto sin
// patrón de teléfono), ese nombre se conserva tal cual.
const PHONE_PATTERN = /\+?\d{7,}/;

export const isPhoneOnlyBizum = (transaction) => {
  if (!transaction.is_bizum || transaction.merchant) return false;

  return PHONE_PATTERN.test(transaction.description || "");
};

// privacyMode && transaction.is_bizum => nunca se renderiza merchant ni
// description (ambos pueden contener el nombre de la otra persona). Este es
// el ÚNICO punto de la app que decide el nombre visible de un movimiento;
// toda pantalla/componente nuevo debe reutilizar esta función, no
// reimplementarla.
//
// Orden de decisión:
//   1. privacyMode && is_bizum         -> placeholder de privacidad
//   2. flow_type === internal_transfer -> "Transferencia entre cuentas"
//   3. Bizum solo identificable por teléfono -> "Bizum recibido/enviado"
//   4. comportamiento normal (merchant || description || "Movimiento")
export const getMovementName = (transaction, privacyMode) => {
  if (privacyMode && transaction.is_bizum) {
    return BIZUM_PRIVACY_PLACEHOLDER;
  }

  if (transaction.flow_type === "internal_transfer") {
    return "Transferencia entre cuentas";
  }

  if (isPhoneOnlyBizum(transaction)) {
    return transaction.direction === "CRDT" ? "Bizum recibido" : "Bizum enviado";
  }

  return transaction.merchant || transaction.description || "Movimiento";
};
