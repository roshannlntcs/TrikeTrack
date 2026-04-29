import ViolatorAvatar from "./ViolatorAvatar"
import type { LiveMapViolator } from "./violator-types"

const MAX_STACK_AVATARS = 6

type ViolatorProfileStackProps = {
  violators: LiveMapViolator[]
  selectedDriverKey: string | null
  onSelect: (violator: LiveMapViolator) => void
  onDismiss: (violator: LiveMapViolator) => void
}

export default function ViolatorProfileStack({
  violators,
  selectedDriverKey,
  onSelect,
  onDismiss
}: ViolatorProfileStackProps) {
  if (violators.length === 0) return null

  const visibleViolators =
    violators.length > MAX_STACK_AVATARS
      ? violators.slice(0, MAX_STACK_AVATARS)
      : violators
  const hiddenViolatorCount = Math.max(0, violators.length - MAX_STACK_AVATARS)

  return (
    <aside className="violator-stack" aria-label="Active outside geofence violators">
      <div className="violator-stack__rail">
        {visibleViolators.map((violator) => (
          <ViolatorAvatar
            key={violator.driverKey}
            violator={violator}
            selected={selectedDriverKey === violator.driverKey}
            onSelect={onSelect}
            onDismiss={onDismiss}
          />
        ))}
        {hiddenViolatorCount > 0 && (
          <div
            className="violator-avatar violator-avatar--overflow"
            aria-label={`${hiddenViolatorCount} more active violators`}
            title={`${hiddenViolatorCount} more active violators`}
          >
            <div className="violator-avatar__frame">
              <span className="violator-avatar__overflow-count">+{hiddenViolatorCount}</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
