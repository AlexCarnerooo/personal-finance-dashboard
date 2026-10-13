// Rutas relativas al mismo origen que sirve el frontend: en desarrollo,
// Vite las redirige al backend (ver vite.config.js); en producción,
// backend y frontend se sirven bajo el mismo origen.
const getJson = async (path) => {
  const response = await fetch(path);
  return response.json();
};

export const fetchDashboard = () => getJson("/api/dashboard");
export const fetchAccounts = () => getJson("/api/accounts");
export const fetchTransactions = () => getJson("/api/transactions");
export const fetchCategories = () => getJson("/api/categories");
export const fetchStats = () => getJson("/api/stats");

export const postSync = async () => {
  const response = await fetch("/api/sync", { method: "POST" });
  return response.json();
};

export const postAuthorizeBank = async (bank) => {
  const response = await fetch(
    `/api/banks/${encodeURIComponent(bank)}/authorize`,
    { method: "POST" }
  );
  return response.json();
};

export const patchTransactionCategory = async (
  transactionId,
  category,
  applyToSimilar
) => {
  const response = await fetch(
    `/api/transactions/${transactionId}/category`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, apply_to_similar: applyToSimilar }),
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
};

export const fetchAllDashboardData = async () => {
  const [dashboard, accounts, transactions, categories, stats] =
    await Promise.all([
      fetchDashboard(),
      fetchAccounts(),
      fetchTransactions(),
      fetchCategories(),
      fetchStats(),
    ]);

  return { dashboard, accounts, transactions, categories, stats };
};
