import Amount from "./Amount";

function AccountCard({ account, privacyMode }) {
  return (
    <div className="account-row">
      <div className="account-row-main">
        <strong>{account.bank}</strong>
        <span className="account-currency">{account.currency}</span>
      </div>

      <span className="account-status">
        {account.balance_updated_at
          ? "Sincronizada"
          : "Pendiente de sincronizar"}
      </span>

      <strong className="account-row-balance">
        {account.balance !== null ? (
          <Amount
            value={account.balance}
            currency={account.currency}
            privacyMode={privacyMode}
          />
        ) : (
          "—"
        )}
      </strong>
    </div>
  );
}

export default AccountCard;
