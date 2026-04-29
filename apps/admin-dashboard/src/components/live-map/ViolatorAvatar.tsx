import { useState } from "react"
import type { LiveMapViolator } from "./violator-types"

type ViolatorAvatarProps = {
  violator: LiveMapViolator
  selected: boolean
  onSelect: (violator: LiveMapViolator) => void
  onDismiss: (violator: LiveMapViolator) => void
}

const getViolatorInitials = (driverName: string) => {
  const parts = driverName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase())
  return initials.join("") || "D"
}

export default function ViolatorAvatar({
  violator,
  selected,
  onSelect,
  onDismiss
}: ViolatorAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = Boolean(violator.avatarUrl) && !imageFailed

  return (
    <div className={`violator-avatar ${selected ? "violator-avatar--selected" : ""}`}>
      <button
        type="button"
        className="violator-avatar__button"
        onClick={() => onSelect(violator)}
        aria-pressed={selected}
        aria-label={`Focus ${violator.driverName} outside geofence violation`}
        title={`${violator.driverName} | ${violator.driverId}`}
      >
        <span className="violator-avatar__frame">
          {showImage ? (
            <img
              src={violator.avatarUrl ?? undefined}
              alt={violator.driverName}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="violator-avatar__fallback" aria-hidden="true">
              {getViolatorInitials(violator.driverName)}
            </span>
          )}
        </span>
        <span className="violator-avatar__badge" aria-hidden="true">
          !
        </span>
      </button>
      <button
        type="button"
        className="violator-avatar__dismiss"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onDismiss(violator)
        }}
        aria-label={`Dismiss ${violator.driverName} violator profile`}
        title={`Dismiss ${violator.driverName}`}
      >
        x
      </button>
    </div>
  )
}
