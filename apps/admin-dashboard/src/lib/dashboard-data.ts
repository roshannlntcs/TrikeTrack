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
  violationCount: number
  createdAt: string
}

export type DashboardNotificationRecord = {
  notificationKey: string
  kind: "violation" | "trip" | "driver" | "emergency" | "appeal"
  page: "alerts" | "trip-logs" | "drivers" | "reports"
  title: string
  body: string
  timestamp: string
  priority: number
  tone: "danger" | "warn" | "info"
  sourceEntityType: "alert" | "trip" | "driver" | "emergency" | "appeal"
  sourceEntityId: string
  isRead: boolean
}

export type DashboardDataSnapshot = {
  drivers: DashboardDriverRecord[]
  tricycles: DashboardTricycleRecord[]
  operationalDrivers: DashboardOperationalDriverRecord[]
  recentViolations: DashboardViolationRecord[]
  recentEmergencies: DashboardEmergencyRecord[]
  recentTrips: DashboardTripRecord[]
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

export const fetchDashboardData = async (accessToken: string) => {
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

  return payload.data
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
