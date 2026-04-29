import type { LiveMapViolator, ViolationPopupPosition } from "./violator-types"

type ViolationPopupProps = {
  violator: LiveMapViolator
  position: ViolationPopupPosition
  onClose: () => void
}

const formatViolationTimestamp = (timestamp: string) => {
  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? timestamp : parsed.toLocaleString()
}

const formatLastSeen = (lastSeenTs?: number | null) => {
  if (!lastSeenTs) return null
  const parsed = new Date(lastSeenTs)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleString()
}

export default function ViolationPopup({
  violator,
  position,
  onClose
}: ViolationPopupProps) {
  return (
    <section
      className={`violation-popup violation-popup--${position.align}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
      aria-live="polite"
    >
      <div className="violation-popup__eyebrow">Outside geofence</div>
      <button
        type="button"
        className="violation-popup__close"
        onClick={onClose}
        aria-label="Close violation details"
      >
        Close
      </button>
      <strong className="violation-popup__name">{violator.driverName}</strong>
      <div className="violation-popup__meta">Driver ID: {violator.driverId}</div>
      <div className="violation-popup__meta">{formatViolationTimestamp(violator.timestamp)}</div>
      {violator.driverOnlineStatus === "offline" && (
        <div className="violation-popup__meta">
          Offline
          {formatLastSeen(violator.lastSeenTs)
            ? ` | Last seen ${formatLastSeen(violator.lastSeenTs)}`
            : ""}
        </div>
      )}
    </section>
  )
}
