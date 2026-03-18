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
  status: "active" | "inactive" | "suspended"
  createdAt: string
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
  violationId: number
  driverId?: number
  driverName?: string
  todaName?: string
  barangayName?: string
  violationTypeCode: string
  violationTypeLabel: string
  description?: string
  detectedAt: string
  status: "open" | "under_review" | "resolved" | "dismissed"
}

export type DashboardTripRecord = {
  tripId: number
  driverId: number
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
  createdAt: string
}

export type DashboardDataSnapshot = {
  drivers: DashboardDriverRecord[]
  tricycles: DashboardTricycleRecord[]
  recentViolations: DashboardViolationRecord[]
  recentTrips: DashboardTripRecord[]
  counts: {
    drivers: number
    tricycles: number
    openViolations: number
    trips: number
  }
}

type DashboardDataResponse = {
  ok?: boolean
  message?: string
  data?: DashboardDataSnapshot
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
