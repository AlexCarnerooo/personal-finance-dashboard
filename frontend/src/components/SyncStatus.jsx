function SyncStatus({ syncResult, onReconnect }) {
  if (!syncResult || syncResult.tone === "success") {
    return null;
  }

  return (
    <div className="sync-alert">
      <span>⚠ Último intento: {syncResult.message}</span>

      {syncResult.banksNeedingReauth.map((bank) => (
        <button
          key={bank}
          type="button"
          className="reconnect-button"
          onClick={() => onReconnect(bank)}
        >
          Reconectar {bank}
        </button>
      ))}
    </div>
  );
}

export default SyncStatus;
