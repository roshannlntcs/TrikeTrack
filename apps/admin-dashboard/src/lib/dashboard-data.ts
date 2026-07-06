import { getSnapshot, saveSnapshot } from "./db"

export type CacheMeta = {
  fromCache: boolean
  savedAt: string
}

export type DashboardDriverRecord = {
  driverId: number
  driverCode: string
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  tricycleId?: number
  tricycleNo?: string
  qrId?: number
  passwordSet: boolean
  firstName: string
  lastName: string
  contactNo?: string
  avatarUrl?: string
  status: "active" | "inactive" | "suspended"
  createdAt: string
}

export type DashboardOperationalDriverRecord = {
  driverId: number
  driverCode: string
  driverName: string
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  tricycleId?: number
  plateNo?: string
  accountStatus: DashboardDriverRecord["status"]
  operationalStatus: "offline" | "online_idle" | "on_trip" | "inactive" | "suspended"
  isOnline: boolean
  lastUpdateAt?: string
  latitude?: number
  longitude?: number
  speed?: number
  heading?: number
  accuracy?: number
  activeTripId?: number
  activeTripStartedAt?: string
  activeRouteId?: number
  activeRouteName?: string
  totalAlertCount: number
  openAlertCount: number
}

export type DashboardTricycleRecord = {
  tricycleId: number
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  plateNo: string
  regNo?: string
  permitExpirationDate?: string
  status: "active" | "inactive" | "suspended"
  createdAt: string
}

export type DashboardViolationRecord = {
  violationId: string
  alertSource: "system_violation" | "driver_violation"
  reportId?: number
  driverId?: number
  driverCode?: string
  driverName?: string
  todaName?: string
  barangayName?: string
  tricycleId?: number
  plateNo?: string
  tripId?: number
  routeId?: number
  routeName?: string
  violationTypeCode: string
  violationTypeLabel: string
  severity: "high" | "medium" | "low"
  description?: string
  locationLabel?: string
  latitude?: number
  longitude?: number
  detectedAt: string
  status: "open" | "under_review" | "resolved" | "dismissed"
}

export type DashboardEmergencyRecord = {
  emergencyId: number
  passengerTrackingKey: string
  qrId: number
  qrToken: string
  driverId: number
  driverCode: string
  driverName: string
  tricycleId?: number
  plateNo?: string
  tripId?: number
  routeId?: number
  routeName?: string
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  source: string
  alertType: string
  status: "created" | "pending_admin" | "acknowledged" | "responding" | "resolved"
  passengerLatitude?: number
  passengerLongitude?: number
  passenger_latitude?: number
  passenger_longitude?: number
  locationAccuracy?: number
  location_accuracy?: number
  locationCapturedAt?: string
  location_captured_at?: string
  passengerLocationName?: string
  passenger_location_name?: string
  latitude?: number
  longitude?: number
  locationLabel?: string
  createdAt: string
  updatedAt: string
  acknowledgedAt?: string
  resolvedAt?: string
  acknowledgedByAdminId?: number
  acknowledgedByAdminEmail?: string
}

export type DashboardTripRecord = {
  tripId: number
  driverId: number
  driverCode: string
  driverName: string
  todaName: string
  barangayName: string
  tricycleId: number
  plateNo: string
  routeId: number
  routeName: string
  tripStart: string
  tripEnd?: string
  tripStatus: "scheduled" | "ongoing" | "completed" | "cancelled"
  durationMinutes?: number
  fareAmount?: number
  distanceKm?: number
  hasPath?: boolean
  pathPointCount?: number
  pathUpdatedAt?: string
  violationCount: number
  reportCount?: number
  issueCount?: number
  relatedReports?: DashboardTripReportRecord[]
  createdAt: string
}

export type DashboardTripReportRecord = {
  reportId: number
  reportTypeLabel: string
  passengerName?: string
  description: string
  reportedAt: string
  status: string
}

export type DashboardNotificationRecord = {
  notificationKey: string
  kind: "violation" | "trip" | "driver" | "emergency" | "appeal" | "password_reset"
  page: "alerts" | "trip-logs" | "drivers" | "reports"
  title: string
  body: string
  timestamp: string
  priority: number
  tone: "danger" | "warn" | "info"
  sourceEntityType: "alert" | "trip" | "driver" | "emergency" | "appeal" | "password_reset"
  sourceEntityId: string
  isRead: boolean
}

export type DriverPasswordResetRequestRecord = {
  requestId: number
  driverId: number
  driverCode: string
  driverName: string
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  status: "pending" | "approved" | "denied" | "completed" | "expired"
  requestedAt: string
  approvedAt?: string
  approvedBy?: number
  expiresAt?: string
  resolvedAt?: string
}

export type DashboardDataSnapshot = {
  drivers: DashboardDriverRecord[]
  tricycles: DashboardTricycleRecord[]
  operationalDrivers: DashboardOperationalDriverRecord[]
  recentViolations: DashboardViolationRecord[]
  recentEmergencies: DashboardEmergencyRecord[]
  recentTrips: DashboardTripRecord[]
  passwordResetRequests: DriverPasswordResetRequestRecord[]
  notifications: DashboardNotificationRecord[]
  counts: {
    drivers: number
    tricycles: number
    onlineDrivers: number
    activeTricycles: number
    ongoingTrips: number
    tripsToday: number
    completedTripsToday: number
    openAlerts: number
    unreadNotifications: number
  }
  cacheMeta?: CacheMeta
}

export type TripPathRecord = {
  tripPathId: number
  tripId: number
  pointCount: number
  rawPointCount?: number
  matchedPointCount?: number
  routeSource?: string
  pathGeojson: unknown
  startedAt?: string
  endedAt?: string
  startLocationName?: string
  endLocationName?: string
  savedLocations?: TripPathSavedLocationRecord[]
  updatedAt: string
  cacheMeta?: CacheMeta
}

export type TripPathSavedLocationRecord = {
  index: number
  recordedAt: string
  latitude: number
  longitude: number
  speed?: number
}

type DashboardDataResponse = {
  ok?: boolean
  message?: string
  data?: DashboardDataSnapshot
}

type NotificationReadResponse = {
  ok?: boolean
  message?: string
}

type TripPathResponse = {
  ok?: boolean
  message?: string
  data?: TripPathRecord | null
}

type ViolationStatusUpdateResponse = {
  ok?: boolean
  message?: string
}

type PasswordResetDecisionResponse = {
  ok?: boolean
  message?: string
  data?: {
    request: DriverPasswordResetRequestRecord
    temporaryPassword?: string
    pushNotificationSent?: boolean
    pushNotificationError?: string
  }
}

const DASHBOARD_CACHE_KEY = "dashboard-data"
const tripPathCacheKey = (tripId: number) => `trip-path:${tripId}`

const normalizeRouteName = (value?: string) => {
  const routeName = value?.trim()
  if (!routeName) return value

  const normalized = routeName.replace(/→/g, "->").replace(/\s+/g, " ").toLowerCase()
  if (normalized === "test route -> live gps tracking" || normalized === "obrero -> route") {
    return "Obrero Route"
  }

  return routeName
}

const normalizeDashboardRoutes = (data: DashboardDataSnapshot): DashboardDataSnapshot => ({
  ...data,
  operationalDrivers: data.operationalDrivers.map((driver) => ({
    ...driver,
    activeRouteName: normalizeRouteName(driver.activeRouteName)
  })),
  recentViolations: data.recentViolations.map((violation) => ({
    ...violation,
    routeName: normalizeRouteName(violation.routeName)
  })),
  recentEmergencies: data.recentEmergencies.map((emergency) => ({
    ...emergency,
    routeName: normalizeRouteName(emergency.routeName)
  })),
  recentTrips: data.recentTrips.map((trip) => ({
    ...trip,
    routeName: normalizeRouteName(trip.routeName) ?? "Obrero Route"
  }))
})

const withCacheMeta = <TData extends object>(
  cached: { savedAt: number; data: TData }
) => ({
  ...cached.data,
  cacheMeta: {
    fromCache: true,
    savedAt: new Date(cached.savedAt).toISOString()
  }
})

export const getCachedDashboardData = async () => {
  const cached = await getSnapshot<DashboardDataSnapshot>(DASHBOARD_CACHE_KEY)
  return cached ? withCacheMeta({ ...cached, data: normalizeDashboardRoutes(cached.data) }) : null
}

export const fetchDashboardData = async (accessToken: string) => {
  try {
    const response = await fetch("/api/admin/dashboard-data", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    const payload = (await response.json().catch(() => ({}))) as DashboardDataResponse
    if (!response.ok || !payload.data) {
      throw new Error(
        payload.message ?? `Dashboard API returned HTTP ${response.status}.`
      )
    }

    const data = normalizeDashboardRoutes(payload.data)
    await saveSnapshot(DASHBOARD_CACHE_KEY, data)
    return data
  } catch (error) {
    const cached = await getCachedDashboardData()
    if (cached) return cached
    throw error
  }
}

export const getCachedTripPath = async (tripId: number) => {
  const cached = await getSnapshot<TripPathRecord>(tripPathCacheKey(tripId))
  return cached ? withCacheMeta(cached) : null
}

export const fetchTripPath = async (accessToken: string, tripId: number) => {
  try {
    const response = await fetch(`/api/admin/trips/${tripId}/path`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    const payload = (await response.json().catch(() => ({}))) as TripPathResponse
    if (!response.ok) {
      throw new Error(payload.message ?? `Trip path API returned HTTP ${response.status}.`)
    }

    if (payload.data) {
      await saveSnapshot(tripPathCacheKey(tripId), payload.data)
    }
    return payload.data ?? null
  } catch (error) {
    const cached = await getCachedTripPath(tripId)
    if (cached) return cached
    throw error
  }
}

export const markDashboardNotificationsRead = async (
  accessToken: string,
  notificationKeys: string[]
) => {
  if (notificationKeys.length === 0) {
    return
  }

  const response = await fetch("/api/admin/notifications/read", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      notificationKeys
    })
  })

  const payload = (await response.json().catch(() => ({}))) as NotificationReadResponse
  if (!response.ok) {
    throw new Error(
      payload.message ?? `Notification API returned HTTP ${response.status}.`
    )
  }
}

export const updateViolationAlertStatus = async (
  accessToken: string,
  alertSource: DashboardViolationRecord["alertSource"],
  violationId: DashboardViolationRecord["violationId"],
  status: Extract<DashboardViolationRecord["status"], "open" | "under_review" | "resolved">
) => {
  const response = await fetch("/api/admin/violations", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      alertSource,
      violationId,
      status
    })
  })

  const payload = (await response.json().catch(() => ({}))) as ViolationStatusUpdateResponse
  if (!response.ok) {
    throw new Error(payload.message ?? `Violation API returned HTTP ${response.status}.`)
  }
}

export const decideDriverPasswordResetRequest = async (
  accessToken: string,
  requestId: number,
  decision: "approve" | "deny"
) => {
  const response = await fetch("/api/admin/driver-password-resets", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      requestId,
      decision
    })
  })

  const payload = (await response.json().catch(() => ({}))) as PasswordResetDecisionResponse
  if (!response.ok || !payload.data) {
    throw new Error(payload.message ?? `Password reset API returned HTTP ${response.status}.`)
  }

  return payload.data
}
