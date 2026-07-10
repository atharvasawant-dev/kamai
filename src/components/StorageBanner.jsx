export default function StorageBanner({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="storage-banner" role="alert">
      <span className="storage-banner-text">⚠️ {message}</span>
      {onDismiss && (
        <button type="button" className="storage-banner-close" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  )
}
