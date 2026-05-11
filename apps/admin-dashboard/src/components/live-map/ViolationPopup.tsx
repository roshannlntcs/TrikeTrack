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
  const isEmergency = violator.source === "passenger_emergency"

  return (
    <section
      className={`violation-popup violation-popup--${position.align}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
      aria-live="polite"
    >
      <div className={`violation-popup__eyebrow${isEmergency ? " violation-popup__eyebrow--emergency" : ""}`}>
        {isEmergency ? "Passenger current location" : "Outside geofence"}
      </div>
      <button
        type="button"
        className="violation-popup__close"
        onClick={onClose}
        aria-label="Close violation details"
      >
        Close
      </button>
      <strong className="violation-popup__name">{violator.driverName}</strong>
      {violator.driverCode && (
        <div className="violation-popup__meta">Driver code: {violator.driverCode}</div>
      )}
      <div className="violation-popup__meta">Driver ID: {violator.driverId}</div>
      {violator.plateNo && (
        <div className="violation-popup__meta">Plate number: {violator.plateNo}</div>
      )}
      {(violator.todaName || violator.barangayName) && (
        <div className="violation-popup__meta">
          {[violator.todaName, violator.barangayName].filter(Boolean).join(" / ")}
        </div>
      )}
      {violator.tripId && (
        <div className="violation-popup__meta">Trip ID: {violator.tripId}</div>
      )}
      {violator.emergencyStatus && (
        <div className="violation-popup__meta">Status: {violator.emergencyStatus}</div>
      )}
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
