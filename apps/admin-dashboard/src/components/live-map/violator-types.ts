export type LiveMapViolator = {
  driverKey: string
  driverId: string
  driverName: string
  avatarUrl?: string | null
  latitude: number
  longitude: number
  violationType: string
  timestamp: string
  status: string
  violationId: string
  source: "live_geofence" | "system_violation" | "driver_violation"
  locationLabel?: string
  tripId?: string | number
  routeName?: string
  resolvedAt?: string | null
  driverOnlineStatus?: "online" | "offline"
  lastSeenTs?: number | null
  uiDismissedByAdmin?: boolean
}

export type ViolationPopupPosition = {
  x: number
  y: number
  align: "left" | "right"
}

export const getViolatorTimestampMs = (violator: Pick<LiveMapViolator, "timestamp">) =>
  new Date(violator.timestamp).getTime()

export const sortViolatorsByRecency = (a: LiveMapViolator, b: LiveMapViolator) =>
  getViolatorTimestampMs(b) - getViolatorTimestampMs(a) ||
  a.driverName.localeCompare(b.driverName)
