import type { AdminProfile } from "./admin-auth-db"
import { ensureDatabaseReady, query } from "./database"

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

type DashboardDriverRow = {
  driver_id: number
  driver_code: string
  toda_id: number
  toda_name: string
  barangay_id: number
  barangay_name: string
  tricycle_id: number | null
  plate_no: string | null
  qr_id: number | null
  password_hash: string | null
  first_name: string
  last_name: string
  contact_no: string | null
  avatar_url: string | null
  status: DashboardDriverRecord["status"]
  created_at: Date
}

type DashboardTricycleRow = {
  tricycle_id: number
  toda_id: number
  toda_name: string
  barangay_id: number
  barangay_name: string
  plate_no: string
  reg_no: string | null
  permit_expiration_date: string | null
  status: DashboardTricycleRecord["status"]
  created_at: Date
}

type DashboardViolationRow = {
  violation_id: number
  driver_id: number | null
  first_name: string | null
  last_name: string | null
  toda_name: string | null
  barangay_name: string | null
  code: string
  label: string
  description: string | null
  detected_at: Date
  status: DashboardViolationRecord["status"]
}

type DashboardTripRow = {
  trip_id: number
  driver_id: number
  first_name: string
  last_name: string
  toda_name: string
  barangay_name: string
  tricycle_id: number
  plate_no: string
  route_id: number
  origin: string
  destination: string
  trip_start: Date
  trip_end: Date | null
  trip_status: DashboardTripRecord["tripStatus"]
  duration_minutes: number | null
  fare_amount: string | null
  created_at: Date
}

const buildScopeClause = (
  profile: AdminProfile,
  todaSql: string,
  barangaySql: string
) => {
  if (profile.role === "superadmin") {
    return { clause: "", params: [] as unknown[] }
  }

  if (profile.role === "barangay_admin" && profile.barangayId) {
    return {
      clause: `WHERE ${barangaySql} = $1`,
      params: [profile.barangayId]
    }
  }

  if (profile.role === "toda_admin" && profile.todaId) {
    return {
      clause: `WHERE ${todaSql} = $1`,
      params: [profile.todaId]
    }
  }

  return { clause: "WHERE 1 = 0", params: [] as unknown[] }
}

const mapDriver = (row: DashboardDriverRow): DashboardDriverRecord => ({
  driverId: Number(row.driver_id),
  driverCode: row.driver_code,
  todaId: Number(row.toda_id),
  todaName: row.toda_name,
  barangayId: Number(row.barangay_id),
  barangayName: row.barangay_name,
  tricycleId: row.tricycle_id === null ? undefined : Number(row.tricycle_id),
  tricycleNo: row.plate_no ?? undefined,
  qrId: row.qr_id === null ? undefined : Number(row.qr_id),
  passwordSet: Boolean(row.password_hash),
  firstName: row.first_name,
  lastName: row.last_name,
  contactNo: row.contact_no ?? undefined,
  avatarUrl: row.avatar_url ?? undefined,
  status: row.status,
  createdAt: row.created_at.toISOString()
})

const mapTricycle = (row: DashboardTricycleRow): DashboardTricycleRecord => ({
  tricycleId: Number(row.tricycle_id),
  todaId: Number(row.toda_id),
  todaName: row.toda_name,
  barangayId: Number(row.barangay_id),
  barangayName: row.barangay_name,
  plateNo: row.plate_no,
  regNo: row.reg_no ?? undefined,
  permitExpirationDate: row.permit_expiration_date ?? undefined,
  status: row.status,
  createdAt: row.created_at.toISOString()
})

const mapViolation = (row: DashboardViolationRow): DashboardViolationRecord => ({
  violationId: Number(row.violation_id),
  driverId: row.driver_id === null ? undefined : Number(row.driver_id),
  driverName:
    row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : undefined,
  todaName: row.toda_name ?? undefined,
  barangayName: row.barangay_name ?? undefined,
  violationTypeCode: row.code,
  violationTypeLabel: row.label,
  description: row.description ?? undefined,
  detectedAt: row.detected_at.toISOString(),
  status: row.status
})

const mapTrip = (row: DashboardTripRow): DashboardTripRecord => ({
  tripId: Number(row.trip_id),
  driverId: Number(row.driver_id),
  driverName: `${row.first_name} ${row.last_name}`,
  todaName: row.toda_name,
  barangayName: row.barangay_name,
  tricycleId: Number(row.tricycle_id),
  plateNo: row.plate_no,
  routeId: Number(row.route_id),
  routeName: `${row.origin} -> ${row.destination}`,
  tripStart: row.trip_start.toISOString(),
  tripEnd: row.trip_end?.toISOString(),
  tripStatus: row.trip_status,
  durationMinutes: row.duration_minutes ?? undefined,
  fareAmount: row.fare_amount === null ? undefined : Number(row.fare_amount),
  createdAt: row.created_at.toISOString()
})

export const getDashboardDataForAdmin = async (profile: AdminProfile) => {
  await ensureDatabaseReady()

  const driverScope = buildScopeClause(profile, "d.toda_id", "b.barangay_id")
  const tricycleScope = buildScopeClause(profile, "tr.toda_id", "b.barangay_id")
  const violationScope = buildScopeClause(profile, "t.toda_id", "b.barangay_id")
  const tripScope = buildScopeClause(profile, "r.toda_id", "b.barangay_id")

  const [driversResult, tricyclesResult, violationsResult, tripsResult] = await Promise.all([
    query<DashboardDriverRow>(
      `
        SELECT
          d.driver_id,
          d.driver_code,
          d.toda_id,
          t.toda_name,
          b.barangay_id,
          b.barangay_name,
          d.tricycle_id,
          tr.plate_no,
          d.qr_id,
          d.password_hash,
          d.first_name,
          d.last_name,
          d.contact_no,
          d.avatar_url,
          d.status,
          d.created_at
        FROM public.drivers d
        JOIN public.todas t
          ON t.toda_id = d.toda_id
        JOIN public.barangays b
          ON b.barangay_id = t.barangay_id
        LEFT JOIN public.tricycles tr
          ON tr.tricycle_id = d.tricycle_id
        ${driverScope.clause}
        ORDER BY b.barangay_name ASC, t.toda_name ASC, d.last_name ASC, d.first_name ASC
      `,
      driverScope.params
    ),
    query<DashboardTricycleRow>(
      `
        SELECT
          tr.tricycle_id,
          tr.toda_id,
          t.toda_name,
          b.barangay_id,
          b.barangay_name,
          tr.plate_no,
          tr.reg_no,
          tr.permit_expiration_date,
          tr.status,
          tr.created_at
        FROM public.tricycles tr
        JOIN public.todas t
          ON t.toda_id = tr.toda_id
        JOIN public.barangays b
          ON b.barangay_id = t.barangay_id
        ${tricycleScope.clause}
        ORDER BY b.barangay_name ASC, t.toda_name ASC, tr.plate_no ASC
      `,
      tricycleScope.params
    ),
    query<DashboardViolationRow>(
      `
        SELECT
          v.violation_id,
          d.driver_id,
          d.first_name,
          d.last_name,
          t.toda_name,
          b.barangay_name,
          vt.code,
          vt.label,
          v.description,
          v.detected_at,
          v.status
        FROM public.violations v
        JOIN public.violation_types vt
          ON vt.violation_type_id = v.violation_type_id
        LEFT JOIN public.drivers d
          ON d.driver_id = v.driver_id
        LEFT JOIN public.todas t
          ON t.toda_id = d.toda_id
        LEFT JOIN public.barangays b
          ON b.barangay_id = t.barangay_id
        ${violationScope.clause}
        ORDER BY v.detected_at DESC
        LIMIT 50
      `,
      violationScope.params
    ),
    query<DashboardTripRow>(
      `
        SELECT
          tp.trip_id,
          d.driver_id,
          d.first_name,
          d.last_name,
          td.toda_name,
          b.barangay_name,
          tr.tricycle_id,
          tr.plate_no,
          r.route_id,
          r.origin,
          r.destination,
          tp.trip_start,
          tp.trip_end,
          tp.trip_status,
          tp.duration_minutes,
          tp.fare_amount,
          tp.created_at
        FROM public.trips tp
        JOIN public.drivers d
          ON d.driver_id = tp.driver_id
        JOIN public.tricycles tr
          ON tr.tricycle_id = tp.tricycle_id
        JOIN public.routes r
          ON r.route_id = tp.route_id
        JOIN public.todas td
          ON td.toda_id = r.toda_id
        JOIN public.barangays b
          ON b.barangay_id = td.barangay_id
        ${tripScope.clause}
        ORDER BY tp.trip_start DESC
        LIMIT 50
      `,
      tripScope.params
    )
  ])

  const drivers = driversResult.rows.map(mapDriver)
  const tricycles = tricyclesResult.rows.map(mapTricycle)
  const recentViolations = violationsResult.rows.map(mapViolation)
  const recentTrips = tripsResult.rows.map(mapTrip)

  return {
    drivers,
    tricycles,
    recentViolations,
    recentTrips,
    counts: {
      drivers: drivers.length,
      tricycles: tricycles.length,
      openViolations: recentViolations.filter((item) => item.status === "open").length,
      trips: recentTrips.length
    }
  } satisfies DashboardDataSnapshot
}
