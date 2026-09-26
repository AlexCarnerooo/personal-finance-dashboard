import { useEffect, useMemo, useState } from "react";
import TransactionRow from "../components/TransactionRow";

const TYPE_OPTIONS = [
  { value: "all", label: "Todos los tipos" },
  { value: "income", label: "Ingresos" },
  { value: "expense", label: "Gastos" },
  { value: "internal_transfer", label: "Transferencias internas" },
  { value: "bizum", label: "Bizum" },
];

const PERIOD_OPTIONS = [
  { value: "all", label: "Todo el histórico" },
  { value: "current_month", label: "Este mes" },
  { value: "previous_month", label: "Mes anterior" },
];

const matchesType = (transaction, typeFilter) => {
  if (typeFilter === "all") return true;
  if (typeFilter === "bizum") return transaction.is_bizum;
  return transaction.flow_type === typeFilter;
};

const matchesPeriod = (transaction, periodFilter) => {
  if (periodFilter === "all" || !transaction.date) return true;

  const date = new Date(transaction.date);
  const now = new Date();

  if (periodFilter === "current_month") {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }

  if (periodFilter === "previous_month") {
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return (
      date.getFullYear() === previousMonth.getFullYear() &&
      date.getMonth() === previousMonth.getMonth()
    );
  }

  return true;
};

function Movements({
  transactions,
  categories,
  accounts,
  privacyMode,
  onCategoryChange,
  initialCategoryFilter,
  reviewToken,
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [bankFilter, setBankFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");

  // Movements ya no se desmonta al navegar, así que el filtro inicial no
  // puede depender de un valor inicial de useState (solo se leería una
  // vez). reviewToken cambia cada vez que se pulsa "Revisar" en Resumen,
  // incluso repetidamente, y vuelve a aplicar el filtro pedido.
  useEffect(() => {
    if (reviewToken) {
      setCategoryFilter(initialCategoryFilter || "all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewToken]);

  const banks = useMemo(
    () => [...new Set(accounts.map((account) => account.bank))],
    [accounts]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      if (
        categoryFilter !== "all" &&
        (transaction.category || "Sin clasificar") !== categoryFilter
      ) {
        return false;
      }

      if (bankFilter !== "all" && transaction.bank !== bankFilter) {
        return false;
      }

      if (!matchesType(transaction, typeFilter)) {
        return false;
      }

      if (!matchesPeriod(transaction, periodFilter)) {
        return false;
      }

      if (term) {
        const haystack = `${transaction.merchant || ""} ${
          transaction.description || ""
        }`.toLowerCase();

        if (!haystack.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, search, categoryFilter, bankFilter, typeFilter, periodFilter]);

  return (
    <div className="view-movements">
      <div className="card filters-card">
        <input
          type="search"
          className="search-input"
          placeholder="Buscar comercio o descripción…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="filters-row">
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">Todas las categorías</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select
            value={bankFilter}
            onChange={(event) => setBankFilter(event.target.value)}
          >
            <option value="all">Todas las cuentas</option>
            {banks.map((bank) => (
              <option key={bank} value={bank}>
                {bank}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={periodFilter}
            onChange={(event) => setPeriodFilter(event.target.value)}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Movimientos</h2>
          <span className="card-subtitle">
            {filtered.length} de {transactions.length}
          </span>
        </div>

        <div className="transactions-list">
          {filtered.length === 0 && (
            <p className="empty-state">
              Ningún movimiento coincide con estos filtros.
            </p>
          )}

          {filtered.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              privacyMode={privacyMode}
              categories={categories}
              editable
              onCategoryChange={onCategoryChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Movements;
