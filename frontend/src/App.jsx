import { useEffect, useState } from "react";

function App() {
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/dashboard")
      .then((response) => response.json())
      .then((data) => setDashboard(data))
      .catch((error) => console.error(error));
  }, []);

  if (!dashboard) {
    return <h1>Cargando...</h1>;
  }

  return (
    <div>
      <h1>Personal Finance Dashboard</h1>

      <h2>Saldo total</h2>
      <p>{dashboard.total_balance_eur.toFixed(2)} €</p>

      <h2>Este mes</h2>

      <p>Ingresos: {dashboard.monthly_income.toFixed(2)} €</p>
      <p>Gastos: {dashboard.monthly_expenses.toFixed(2)} €</p>
      <p>Neto: {dashboard.monthly_net.toFixed(2)} €</p>

      <h2>Últimos movimientos</h2>

      {dashboard.recent_transactions.map((transaction, index) => (
        <div key={index}>
          {transaction.merchant} — {transaction.amount.toFixed(2)} €
        </div>
      ))}
    </div>
  );
}

export default App;