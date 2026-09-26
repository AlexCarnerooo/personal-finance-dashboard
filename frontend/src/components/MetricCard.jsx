import Amount from "./Amount";

function MetricCard({
  label,
  value,
  currency = "EUR",
  tone,
  sublabel,
  privacyMode,
  sign = false,
}) {
  return (
    <div className="metric-card">
      <p>{label}</p>
      <strong className={tone}>
        <Amount
          value={value}
          currency={currency}
          privacyMode={privacyMode}
          sign={sign}
        />
      </strong>
      {sublabel && <span>{sublabel}</span>}
    </div>
  );
}

export default MetricCard;
