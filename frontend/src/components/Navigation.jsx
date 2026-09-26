const VIEWS = [
  { id: "summary", label: "Resumen" },
  { id: "movements", label: "Movimientos" },
  { id: "statistics", label: "Estadísticas" },
  { id: "investments", label: "Inversiones" },
];

function Navigation({ activeView, onChange }) {
  return (
    <nav className="main-nav">
      {VIEWS.map((view) => (
        <button
          key={view.id}
          type="button"
          className={`main-nav-item${
            activeView === view.id ? " active" : ""
          }`}
          onClick={() => onChange(view.id)}
        >
          {view.label}
        </button>
      ))}
    </nav>
  );
}

export default Navigation;
