import { randomBytes } from "node:crypto"
import type { PoolClient } from "pg"
import type { AdminProfile } from "./admin-auth-db"
import { ensureDatabaseReady, query, withTransaction } from "./database"

export type EntityStatus = "active" | "inactive" | "suspended"
export type QrStatus = "active" | "inactive" | "revoked" | "expired"
export type AdministratorRole = AdminProfile["role"]

export type AdministratorRecord = {
  adminId: number
  authUserId: string
  email: string
  role: AdministratorRole
  status: EntityStatus
  barangayId?: number
  barangayName?: string
  todaId?: number
  todaName?: string
  city?: string
  createdAt: string
}

export type BarangayRecord = {
  barangayId: number
  barangayName: string
  district?: string
  city: string
  status: EntityStatus
  todaCount: number
  createdAt: string
}

export type TodaRecord = {
  todaId: number
  barangayId: number
  barangayName: string
  todaName: string
  status: EntityStatus
  driverCount: number
  tricycleCount: number
  createdAt: string
}

export type DriverRecord = {
  driverId: number
  driverCode: string
  todaId: number
  todaName: string
  barangayName: string
  tricycleId?: number
  tricycleNo?: string
  qrId?: number
  qrToken?: string
  qrStatus?: QrStatus
  qrIssuedAt?: string
  reportPath?: string
  passwordSet: boolean
  firstName: string
  lastName: string
  contactNo?: string
  status: EntityStatus
  createdAt: string
}

export type TricycleRecord = {
  tricycleId: number
  todaId: number
  todaName: string
  barangayName: string
  plateNo: string
  regNo?: string
  permitExpirationDate?: string
  status: EntityStatus
  createdAt: string
}

export type RouteRecord = {
  routeId: number
  todaId: number
  todaName: string
  barangayName: string
  origin: string
  destination: string
  defaultFareAmount?: number
  geofenceGeojson?: unknown
  status: EntityStatus
  createdAt: string
}

export type MasterDataSnapshot = {
  administrators: AdministratorRecord[]
  barangays: BarangayRecord[]
  todas: TodaRecord[]
  drivers: DriverRecord[]
  tricycles: TricycleRecord[]
  routes: RouteRecord[]
}

export type CreateBarangayInput = {
  barangayName: string
  district?: string
  city: string
}

export type UpdateBarangayInput = Partial<CreateBarangayInput> & {
  status?: EntityStatus
}

export type CreateTodaInput = {
  barangayId: number
  todaName: string
}

export type UpdateTodaInput = Partial<CreateTodaInput> & {
  status?: EntityStatus
}

export type CreateDriverInput = {
  todaId: number
  tricycleId?: number
  firstName: string
  lastName: string
  contactNo?: string
}

export type UpdateDriverInput = {
  todaId?: number
  tricycleId?: number | null
  firstName?: string
  lastName?: string
  contactNo?: string | null
  status?: EntityStatus
  regenerateQr?: boolean
}

export type CreateTricycleInput = {
  todaId: number
  plateNo: string
  regNo?: string
  permitExpirationDate?: string
}

export type UpdateTricycleInput = {
  todaId?: number
  plateNo?: string
  regNo?: string | null
  permitExpirationDate?: string | null
  status?: EntityStatus
}

export type CreateRouteInput = {
  todaId: number
  origin: string
  destination: string
  defaultFareAmount?: number
  geofenceGeojson?: unknown
}

export type UpdateRouteInput = Partial<CreateRouteInput> & {
  status?: EntityStatus
}

export type CreateAdministratorInput = {
  email: string
  password?: string
  role: AdministratorRole
  barangayId?: number | null
  todaId?: number | null
  status?: EntityStatus
}

export type UpdateAdministratorInput = {
  role?: AdministratorRole
  barangayId?: number | null
  todaId?: number | null
  status?: EntityStatus
}

type AdministratorRow = {
  admin_id: number
  auth_user_id: string
  email: string
  admin_role: AdministratorRole
  status: EntityStatus
  barangay_id: number | null
  barangay_name: string | null
  toda_id: number | null
  toda_name: string | null
  city: string | null
  created_at: Date
}

type BarangayRow = {
  barangay_id: number
  barangay_name: string
  district: string | null
  city: string
  status: EntityStatus
  toda_count: number
  created_at: Date
}

type TodaRow = {
  toda_id: number
  barangay_id: number
  barangay_name: string
  toda_name: string
  status: EntityStatus
  driver_count: number
  tricycle_count: number
  created_at: Date
}

type DriverRow = {
  driver_id: number
  driver_code: string
  toda_id: number
  toda_name: string
  barangay_name: string
  tricycle_id: number | null
  plate_no: string | null
  qr_id: number | null
  qr_token: string | null
  qr_status: QrStatus | null
  qr_issued_at: Date | null
  password_hash: string | null
  first_name: string
  last_name: string
  contact_no: string | null
  status: EntityStatus
  created_at: Date
}

type TricycleRow = {
  tricycle_id: number
  toda_id: number
  toda_name: string
  barangay_name: string
  plate_no: string
  reg_no: string | null
  permit_expiration_date: string | null
  status: EntityStatus
  created_at: Date
}

type RouteRow = {
  route_id: number
  toda_id: number
  toda_name: string
  barangay_name: string
  origin: string
  destination: string
  default_fare_amount: string | null
  geofence_geojson: unknown | null
  status: EntityStatus
  created_at: Date
}

const mapAdministrator = (row: AdministratorRow): AdministratorRecord => ({
  adminId: Number(row.admin_id),
  authUserId: row.auth_user_id,
  email: row.email,
  role: row.admin_role,
  status: row.status,
  barangayId: row.barangay_id === null ? undefined : Number(row.barangay_id),
  barangayName: row.barangay_name ?? undefined,
  todaId: row.toda_id === null ? undefined : Number(row.toda_id),
  todaName: row.toda_name ?? undefined,
  city: row.city ?? undefined,
  createdAt: row.created_at.toISOString()
})

const mapBarangay = (row: BarangayRow): BarangayRecord => ({
  barangayId: row.barangay_id,
  barangayName: row.barangay_name,
  district: row.district ?? undefined,
  city: row.city,
  status: row.status,
  todaCount: Number(row.toda_count),
  createdAt: row.created_at.toISOString()
})

const mapToda = (row: TodaRow): TodaRecord => ({
  todaId: Number(row.toda_id),
  barangayId: Number(row.barangay_id),
  barangayName: row.barangay_name,
  todaName: row.toda_name,
  status: row.status,
  driverCount: Number(row.driver_count),
  tricycleCount: Number(row.tricycle_count),
  createdAt: row.created_at.toISOString()
})

const mapDriver = (row: DriverRow): DriverRecord => ({
  driverId: Number(row.driver_id),
  driverCode: row.driver_code,
  todaId: Number(row.toda_id),
  todaName: row.toda_name,
  barangayName: row.barangay_name,
  tricycleId: row.tricycle_id === null ? undefined : Number(row.tricycle_id),
  tricycleNo: row.plate_no ?? undefined,
  qrId: row.qr_id === null ? undefined : Number(row.qr_id),
  qrToken: row.qr_token ?? undefined,
  qrStatus: row.qr_status ?? undefined,
  qrIssuedAt: row.qr_issued_at?.toISOString(),
  reportPath: row.qr_token ? `/report/${row.qr_token}` : undefined,
  passwordSet: Boolean(row.password_hash),
  firstName: row.first_name,
  lastName: row.last_name,
  contactNo: row.contact_no ?? undefined,
  status: row.status,
  createdAt: row.created_at.toISOString()
})

const mapTricycle = (row: TricycleRow): TricycleRecord => ({
  tricycleId: Number(row.tricycle_id),
  todaId: Number(row.toda_id),
  todaName: row.toda_name,
  barangayName: row.barangay_name,
  plateNo: row.plate_no,
  regNo: row.reg_no ?? undefined,
  permitExpirationDate: row.permit_expiration_date ?? undefined,
  status: row.status,
  createdAt: row.created_at.toISOString()
})

const mapRoute = (row: RouteRow): RouteRecord => ({
  routeId: Number(row.route_id),
  todaId: Number(row.toda_id),
  todaName: row.toda_name,
  barangayName: row.barangay_name,
  origin: row.origin,
  destination: row.destination,
  defaultFareAmount:
    row.default_fare_amount === null ? undefined : Number(row.default_fare_amount),
  geofenceGeojson: row.geofence_geojson ?? undefined,
  status: row.status,
  createdAt: row.created_at.toISOString()
})

const hasOwn = <T extends object>(value: T, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(value, key)

const SUPABASE_URL = process.env.SUPABASE_URL?.trim().replace(/\/$/, "")
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const getAuthUserIdByEmail = async (email: string) => {
  const result = await query<{ id: string }>(
    `
      SELECT id
      FROM auth.users
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    [email]
  )

  return result.rows[0]?.id
}

const createSupabaseAuthUser = async (email: string, password: string) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Cannot create a new authenticated admin user because SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Add a temporary password only when Supabase admin credentials are configured, or link an existing auth user by email."
    )
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        source: "admin-dashboard"
      }
    })
  })

  const payload = (await response.json().catch(() => ({}))) as {
    id?: string
    message?: string
    error_description?: string
    error?: string
  }

  if (!response.ok || !payload.id) {
    throw new Error(
      payload.message ??
        payload.error_description ??
        payload.error ??
        `Supabase Auth returned HTTP ${response.status}.`
    )
  }

  return payload.id
}

const B_BARANGAY_SELECT = `
  SELECT
    b.barangay_id,
    b.barangay_name,
    b.district,
    b.city,
    b.status,
    COUNT(t.toda_id)::int AS toda_count,
    b.created_at
  FROM public.barangays b
  LEFT JOIN public.todas t
    ON t.barangay_id = b.barangay_id
`

const T_TODA_SELECT = `
  SELECT
    t.toda_id,
    t.barangay_id,
    b.barangay_name,
    t.toda_name,
    t.status,
    COUNT(DISTINCT d.driver_id)::int AS driver_count,
    COUNT(DISTINCT tr.tricycle_id)::int AS tricycle_count,
    t.created_at
  FROM public.todas t
  JOIN public.barangays b
    ON b.barangay_id = t.barangay_id
  LEFT JOIN public.drivers d
    ON d.toda_id = t.toda_id
  LEFT JOIN public.tricycles tr
    ON tr.toda_id = t.toda_id
`

const D_DRIVER_SELECT = `
  SELECT
    d.driver_id,
    d.driver_code,
    d.toda_id,
    t.toda_name,
    b.barangay_name,
    d.tricycle_id,
    tr.plate_no,
    d.qr_id,
    qr.qr_token,
    qr.status AS qr_status,
    qr.issued_at AS qr_issued_at,
    d.password_hash,
    d.first_name,
    d.last_name,
    d.contact_no,
    d.status,
    d.created_at
  FROM public.drivers d
  JOIN public.todas t
    ON t.toda_id = d.toda_id
  JOIN public.barangays b
    ON b.barangay_id = t.barangay_id
  LEFT JOIN public.tricycles tr
    ON tr.tricycle_id = d.tricycle_id
  LEFT JOIN public.qr_codes qr
    ON qr.qr_id = d.qr_id
`

const DRIVER_QR_TOKEN_BYTES = 24

type DriverQrStateRow = {
  qr_id: number | null
  qr_status: QrStatus | null
}

const generateDriverQrToken = () => randomBytes(DRIVER_QR_TOKEN_BYTES).toString("base64url")

const createDriverQrCode = async (
  client: PoolClient,
  driverId: number,
  tricycleId: number | null
) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await client.query<{ qr_id: number }>(
        `
          INSERT INTO public.qr_codes (
            driver_id,
            tricycle_id,
            qr_token,
            status
          )
          VALUES ($1, $2, $3, 'active')
          RETURNING qr_id
        `,
        [driverId, tricycleId, generateDriverQrToken()]
      )

      const qrId = result.rows[0]?.qr_id
      if (!qrId) {
        throw new Error("Unable to create a QR code for this driver.")
      }

      return Number(qrId)
    } catch (error) {
      const pgError = error as { code?: string }
      if (pgError.code === "23505" && attempt < 4) {
        continue
      }
      throw error
    }
  }

  throw new Error("Unable to create a unique QR code for this driver.")
}

const ensureDriverQrCode = async (
  client: PoolClient,
  driverId: number,
  tricycleId: number | null
) => {
  const stateResult = await client.query<DriverQrStateRow>(
    `
      SELECT
        d.qr_id,
        qr.status AS qr_status
      FROM public.drivers d
      LEFT JOIN public.qr_codes qr
        ON qr.qr_id = d.qr_id
      WHERE d.driver_id = $1
      LIMIT 1
    `,
    [driverId]
  )

  const state = stateResult.rows[0]
  if (!state) {
    throw new Error("Driver not found.")
  }

  let nextQrId = state.qr_id === null || state.qr_status === null ? null : Number(state.qr_id)
  if (nextQrId === null) {
    nextQrId = await createDriverQrCode(client, driverId, tricycleId)
  } else {
    await client.query(
      `
        UPDATE public.qr_codes
        SET
          driver_id = $2,
          tricycle_id = $3,
          status = 'active',
          expires_at = NULL
        WHERE qr_id = $1
      `,
      [nextQrId, driverId, tricycleId]
    )
  }

  await client.query(
    `
      UPDATE public.qr_codes
      SET
        driver_id = $1,
        status = 'revoked',
        expires_at = COALESCE(expires_at, NOW())
      WHERE driver_id = $1
        AND qr_id <> $2
        AND status = 'active'
    `,
    [driverId, nextQrId]
  )

  await client.query(
    `
      UPDATE public.drivers
      SET qr_id = $2
      WHERE driver_id = $1
    `,
    [driverId, nextQrId]
  )
}

const regenerateDriverQrCode = async (
  client: PoolClient,
  driverId: number,
  tricycleId: number | null
) => {
  await client.query(
    `
      UPDATE public.qr_codes
      SET
        status = 'revoked',
        expires_at = COALESCE(expires_at, NOW())
      WHERE driver_id = $1
        AND status = 'active'
    `,
    [driverId]
  )

  const qrId = await createDriverQrCode(client, driverId, tricycleId)
  await client.query(
    `
      UPDATE public.drivers
      SET qr_id = $2
      WHERE driver_id = $1
    `,
    [driverId, qrId]
  )
}

const backfillDriverQrCodes = async (rows: DriverRow[]) => {
  const missingRows = rows.filter((row) => row.qr_id === null || row.qr_token === null)
  if (missingRows.length === 0) return false

  await withTransaction(async (client) => {
    for (const row of missingRows) {
      await ensureDriverQrCode(
        client,
        Number(row.driver_id),
        row.tricycle_id === null ? null : Number(row.tricycle_id)
      )
    }
  })

  return true
}

const TR_TRICYCLE_SELECT = `
  SELECT
    tr.tricycle_id,
    tr.toda_id,
    t.toda_name,
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
`

const R_ROUTE_SELECT = `
  SELECT
    r.route_id,
    r.toda_id,
    t.toda_name,
    b.barangay_name,
    r.origin,
    r.destination,
    r.default_fare_amount,
    r.geofence_geojson,
    r.status,
    r.created_at
  FROM public.routes r
  JOIN public.todas t
    ON t.toda_id = r.toda_id
  JOIN public.barangays b
    ON b.barangay_id = t.barangay_id
`

const A_ADMINISTRATOR_SELECT = `
  SELECT
    aa.admin_id,
    aa.auth_user_id,
    au.email,
    aa.admin_role,
    aa.status,
    COALESCE(aa.barangay_id, tb.barangay_id) AS barangay_id,
    COALESCE(b.barangay_name, tb.barangay_name) AS barangay_name,
    aa.toda_id,
    t.toda_name,
    COALESCE(b.city, tb.city) AS city,
    aa.created_at
  FROM public.admin_accounts aa
  JOIN auth.users au
    ON au.id = aa.auth_user_id
  LEFT JOIN public.barangays b
    ON b.barangay_id = aa.barangay_id
  LEFT JOIN public.todas t
    ON t.toda_id = aa.toda_id
  LEFT JOIN public.barangays tb
    ON tb.barangay_id = t.barangay_id
`

const getBarangayById = async (barangayId: number) => {
  const result = await query<BarangayRow>(
    `
      ${B_BARANGAY_SELECT}
      WHERE b.barangay_id = $1
      GROUP BY b.barangay_id
    `,
    [barangayId]
  )

  const row = result.rows[0]
  if (!row) throw new Error("Barangay not found.")
  return mapBarangay(row)
}

const getTodaById = async (todaId: number) => {
  const result = await query<TodaRow>(
    `
      ${T_TODA_SELECT}
      WHERE t.toda_id = $1
      GROUP BY t.toda_id, b.barangay_name
    `,
    [todaId]
  )

  const row = result.rows[0]
  if (!row) throw new Error("TODA not found.")
  return mapToda(row)
}

export const getDriverById = async (driverId: number) => {
  const result = await query<DriverRow>(
    `
      ${D_DRIVER_SELECT}
      WHERE d.driver_id = $1
      LIMIT 1
    `,
    [driverId]
  )

  const row = result.rows[0]
  if (!row) throw new Error("Driver not found.")
  return mapDriver(row)
}

export const getTricycleById = async (tricycleId: number) => {
  const result = await query<TricycleRow>(
    `
      ${TR_TRICYCLE_SELECT}
      WHERE tr.tricycle_id = $1
      LIMIT 1
    `,
    [tricycleId]
  )

  const row = result.rows[0]
  if (!row) throw new Error("Tricycle not found.")
  return mapTricycle(row)
}

const getRouteById = async (routeId: number) => {
  const result = await query<RouteRow>(
    `
      ${R_ROUTE_SELECT}
      WHERE r.route_id = $1
      LIMIT 1
    `,
    [routeId]
  )

  const row = result.rows[0]
  if (!row) throw new Error("Route not found.")
  return mapRoute(row)
}

const getAdministratorById = async (adminId: number) => {
  const result = await query<AdministratorRow>(
    `
      ${A_ADMINISTRATOR_SELECT}
      WHERE aa.admin_id = $1
      LIMIT 1
    `,
    [adminId]
  )

  const row = result.rows[0]
  if (!row) throw new Error("Administrator not found.")
  return mapAdministrator(row)
}

export const listMasterData = async (): Promise<MasterDataSnapshot> => {
  await ensureDatabaseReady()

  const [administrators, barangays, todas, initialDrivers, tricycles, routes] = await Promise.all([
    query<AdministratorRow>(
      `
        ${A_ADMINISTRATOR_SELECT}
        ORDER BY aa.created_at DESC, au.email ASC
      `
    ),
    query<BarangayRow>(
      `
        ${B_BARANGAY_SELECT}
        GROUP BY b.barangay_id
        ORDER BY b.barangay_name ASC
      `
    ),
    query<TodaRow>(
      `
        ${T_TODA_SELECT}
        GROUP BY t.toda_id, b.barangay_name
        ORDER BY b.barangay_name ASC, t.toda_name ASC
      `
    ),
    query<DriverRow>(
      `
        ${D_DRIVER_SELECT}
        ORDER BY b.barangay_name ASC, t.toda_name ASC, d.last_name ASC, d.first_name ASC
      `
    ),
    query<TricycleRow>(
      `
        ${TR_TRICYCLE_SELECT}
        ORDER BY b.barangay_name ASC, t.toda_name ASC, tr.plate_no ASC
      `
    ),
    query<RouteRow>(
      `
        ${R_ROUTE_SELECT}
        ORDER BY b.barangay_name ASC, t.toda_name ASC, r.origin ASC, r.destination ASC
      `
    )
  ])

  const driverRows = (await backfillDriverQrCodes(initialDrivers.rows))
    ? (
        await query<DriverRow>(
          `
            ${D_DRIVER_SELECT}
            ORDER BY b.barangay_name ASC, t.toda_name ASC, d.last_name ASC, d.first_name ASC
          `
        )
      ).rows
    : initialDrivers.rows

  return {
    administrators: administrators.rows.map(mapAdministrator),
    barangays: barangays.rows.map(mapBarangay),
    todas: todas.rows.map(mapToda),
    drivers: driverRows.map(mapDriver),
    tricycles: tricycles.rows.map(mapTricycle),
    routes: routes.rows.map(mapRoute)
  }
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

export const listMasterDataForAdmin = async (
  profile: AdminProfile
): Promise<MasterDataSnapshot> => {
  await ensureDatabaseReady()

  const administratorScope =
    profile.role === "superadmin"
      ? { clause: "", params: [] as unknown[] }
      : profile.role === "barangay_admin" && profile.barangayId
        ? {
            clause:
              "WHERE COALESCE(aa.barangay_id, tb.barangay_id) = $1",
            params: [profile.barangayId]
          }
        : profile.role === "toda_admin" && profile.todaId
          ? { clause: "WHERE aa.toda_id = $1", params: [profile.todaId] }
          : { clause: "WHERE 1 = 0", params: [] as unknown[] }
  const barangayScope = buildScopeClause(profile, "t.toda_id", "b.barangay_id")
  const todaScope = buildScopeClause(profile, "t.toda_id", "b.barangay_id")
  const driverScope = buildScopeClause(profile, "d.toda_id", "b.barangay_id")
  const tricycleScope = buildScopeClause(profile, "tr.toda_id", "b.barangay_id")
  const routeScope = buildScopeClause(profile, "r.toda_id", "b.barangay_id")

  const [administrators, barangays, todas, initialDrivers, tricycles, routes] = await Promise.all([
    query<AdministratorRow>(
      `
        ${A_ADMINISTRATOR_SELECT}
        ${administratorScope.clause}
        ORDER BY aa.created_at DESC, au.email ASC
      `,
      administratorScope.params
    ),
    query<BarangayRow>(
      `
        ${B_BARANGAY_SELECT}
        ${barangayScope.clause}
        GROUP BY b.barangay_id
        ORDER BY b.barangay_name ASC
      `,
      barangayScope.params
    ),
    query<TodaRow>(
      `
        ${T_TODA_SELECT}
        ${todaScope.clause}
        GROUP BY t.toda_id, b.barangay_name
        ORDER BY b.barangay_name ASC, t.toda_name ASC
      `,
      todaScope.params
    ),
    query<DriverRow>(
      `
        ${D_DRIVER_SELECT}
        ${driverScope.clause}
        ORDER BY b.barangay_name ASC, t.toda_name ASC, d.last_name ASC, d.first_name ASC
      `,
      driverScope.params
    ),
    query<TricycleRow>(
      `
        ${TR_TRICYCLE_SELECT}
        ${tricycleScope.clause}
        ORDER BY b.barangay_name ASC, t.toda_name ASC, tr.plate_no ASC
      `,
      tricycleScope.params
    ),
    query<RouteRow>(
      `
        ${R_ROUTE_SELECT}
        ${routeScope.clause}
        ORDER BY b.barangay_name ASC, t.toda_name ASC, r.origin ASC, r.destination ASC
      `,
      routeScope.params
    )
  ])

  const driverRows = (await backfillDriverQrCodes(initialDrivers.rows))
    ? (
        await query<DriverRow>(
          `
            ${D_DRIVER_SELECT}
            ${driverScope.clause}
            ORDER BY b.barangay_name ASC, t.toda_name ASC, d.last_name ASC, d.first_name ASC
          `,
          driverScope.params
        )
      ).rows
    : initialDrivers.rows

  return {
    administrators: administrators.rows.map(mapAdministrator),
    barangays: barangays.rows.map(mapBarangay),
    todas: todas.rows.map(mapToda),
    drivers: driverRows.map(mapDriver),
    tricycles: tricycles.rows.map(mapTricycle),
    routes: routes.rows.map(mapRoute)
  }
}

export const createAdministrator = async (input: CreateAdministratorInput) => {
  await ensureDatabaseReady()

  const email = normalizeEmail(input.email)
  const password = input.password?.trim()
  const nextStatus = input.status ?? "active"
  const nextBarangayId = input.role === "barangay_admin" ? (input.barangayId ?? null) : null
  const nextTodaId = input.role === "toda_admin" ? (input.todaId ?? null) : null

  if (!email) {
    throw new Error("Administrator email is required.")
  }

  if (input.role === "barangay_admin" && !nextBarangayId) {
    throw new Error("Barangay admin accounts must be assigned to a barangay.")
  }

  if (input.role === "toda_admin" && !nextTodaId) {
    throw new Error("TODA admin accounts must be assigned to a TODA.")
  }

  let authUserId = await getAuthUserIdByEmail(email)
  if (!authUserId) {
    if (!password || password.length < 8) {
      throw new Error(
        "No existing auth user was found for this email. Provide a temporary password with at least 8 characters to create one."
      )
    }

    authUserId = await createSupabaseAuthUser(email, password)
  }

  const existing = await query<{ admin_id: number }>(
    `
      SELECT admin_id
      FROM public.admin_accounts
      WHERE auth_user_id = $1
      LIMIT 1
    `,
    [authUserId]
  )

  if (existing.rows[0]) {
    throw new Error("This email is already linked to an administrator account.")
  }

  const result = await query<{ admin_id: number }>(
    `
      INSERT INTO public.admin_accounts (
        auth_user_id,
        admin_role,
        barangay_id,
        toda_id,
        status
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING admin_id
    `,
    [
      authUserId,
      input.role,
      input.role === "barangay_admin" ? nextBarangayId : null,
      input.role === "toda_admin" ? nextTodaId : null,
      nextStatus
    ]
  )

  return getAdministratorById(result.rows[0].admin_id)
}

export const updateAdministrator = async (
  adminId: number,
  input: UpdateAdministratorInput
) => {
  await ensureDatabaseReady()

  const current = await getAdministratorById(adminId)
  const nextRole = input.role ?? current.role
  const nextStatus = input.status ?? current.status
  const nextBarangayId =
    input.barangayId !== undefined
      ? input.barangayId
      : nextRole === "barangay_admin"
        ? (current.barangayId ?? null)
        : null
  const nextTodaId =
    input.todaId !== undefined
      ? input.todaId
      : nextRole === "toda_admin"
        ? (current.todaId ?? null)
        : null

  if (nextRole === "barangay_admin" && !nextBarangayId) {
    throw new Error("Barangay admin accounts must be assigned to a barangay.")
  }

  if (nextRole === "toda_admin" && !nextTodaId) {
    throw new Error("TODA admin accounts must be assigned to a TODA.")
  }

  await query(
    `
      UPDATE public.admin_accounts
      SET
        admin_role = $2,
        barangay_id = $3,
        toda_id = $4,
        status = $5
      WHERE admin_id = $1
    `,
    [
      adminId,
      nextRole,
      nextRole === "barangay_admin" ? nextBarangayId : null,
      nextRole === "toda_admin" ? nextTodaId : null,
      nextStatus
    ]
  )

  return getAdministratorById(adminId)
}

export const deleteAdministrator = async (adminId: number, currentAdminId: number) => {
  await ensureDatabaseReady()

  if (adminId === currentAdminId) {
    throw new Error("You cannot delete your own administrator account.")
  }

  const current = await getAdministratorById(adminId)

  if (current.role === "superadmin") {
    const superadminCount = await query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM public.admin_accounts
        WHERE admin_role = 'superadmin'
          AND status = 'active'
      `
    )

    if (Number(superadminCount.rows[0]?.count ?? "0") <= 1) {
      throw new Error("Cannot delete the last active superadmin account.")
    }
  }

  await query(
    `
      DELETE FROM public.admin_accounts
      WHERE admin_id = $1
    `,
    [adminId]
  )
}

export const createBarangay = async (input: CreateBarangayInput) => {
  await ensureDatabaseReady()

  const result = await query<{ barangay_id: number }>(
    `
      INSERT INTO public.barangays (barangay_name, district, city)
      VALUES ($1, $2, $3)
      RETURNING barangay_id
    `,
    [input.barangayName, input.district ?? null, input.city]
  )

  return getBarangayById(result.rows[0].barangay_id)
}

export const updateBarangay = async (barangayId: number, input: UpdateBarangayInput) => {
  await ensureDatabaseReady()

  await query(
    `
      UPDATE public.barangays
      SET barangay_name = COALESCE($2, barangay_name),
          district = CASE WHEN $3::text is null THEN district ELSE $3 END,
          city = COALESCE($4, city),
          status = COALESCE($5, status)
      WHERE barangay_id = $1
    `,
    [
      barangayId,
      input.barangayName ?? null,
      input.district ?? null,
      input.city ?? null,
      input.status ?? null
    ]
  )

  return getBarangayById(barangayId)
}

export const deleteBarangay = async (barangayId: number) => {
  await ensureDatabaseReady()

  const [{ rows: todaRows }, { rows: adminRows }] = await Promise.all([
    query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM public.todas
        WHERE barangay_id = $1
      `,
      [barangayId]
    ),
    query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM public.admin_accounts
        WHERE barangay_id = $1
      `,
      [barangayId]
    )
  ])

  const todaCount = Number(todaRows[0]?.count ?? "0")
  const adminCount = Number(adminRows[0]?.count ?? "0")

  if (todaCount > 0) {
    throw new Error(
      `Cannot delete barangay while ${todaCount} TODA${todaCount === 1 ? " is" : "s are"} still assigned to it.`
    )
  }

  if (adminCount > 0) {
    throw new Error(
      `Cannot delete barangay while ${adminCount} admin account${adminCount === 1 ? " is" : "s are"} still assigned to it.`
    )
  }

  await query(
    `
      DELETE FROM public.barangays
      WHERE barangay_id = $1
    `,
    [barangayId]
  )
}

export const createToda = async (input: CreateTodaInput) => {
  await ensureDatabaseReady()

  const result = await query<{ toda_id: number }>(
    `
      INSERT INTO public.todas (barangay_id, toda_name)
      VALUES ($1, $2)
      RETURNING toda_id
    `,
    [input.barangayId, input.todaName]
  )

  return getTodaById(result.rows[0].toda_id)
}

export const updateToda = async (todaId: number, input: UpdateTodaInput) => {
  await ensureDatabaseReady()

  await query(
    `
      UPDATE public.todas
      SET barangay_id = COALESCE($2, barangay_id),
          toda_name = COALESCE($3, toda_name),
          status = COALESCE($4, status)
      WHERE toda_id = $1
    `,
    [todaId, input.barangayId ?? null, input.todaName ?? null, input.status ?? null]
  )

  return getTodaById(todaId)
}

export const deleteToda = async (todaId: number) => {
  await ensureDatabaseReady()

  const [
    { rows: driverRows },
    { rows: tricycleRows },
    { rows: routeRows },
    { rows: adminRows }
  ] = await Promise.all([
    query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM public.drivers
        WHERE toda_id = $1
      `,
      [todaId]
    ),
    query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM public.tricycles
        WHERE toda_id = $1
      `,
      [todaId]
    ),
    query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM public.routes
        WHERE toda_id = $1
      `,
      [todaId]
    ),
    query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM public.admin_accounts
        WHERE toda_id = $1
      `,
      [todaId]
    )
  ])

  const driverCount = Number(driverRows[0]?.count ?? "0")
  const tricycleCount = Number(tricycleRows[0]?.count ?? "0")
  const routeCount = Number(routeRows[0]?.count ?? "0")
  const adminCount = Number(adminRows[0]?.count ?? "0")

  if (driverCount > 0) {
    throw new Error(
      `Cannot delete TODA while ${driverCount} driver${driverCount === 1 ? " is" : "s are"} still assigned to it.`
    )
  }

  if (tricycleCount > 0) {
    throw new Error(
      `Cannot delete TODA while ${tricycleCount} tricycle${tricycleCount === 1 ? " is" : "s are"} still assigned to it.`
    )
  }

  if (routeCount > 0) {
    throw new Error(
      `Cannot delete TODA while ${routeCount} route${routeCount === 1 ? " is" : "s are"} still assigned to it.`
    )
  }

  if (adminCount > 0) {
    throw new Error(
      `Cannot delete TODA while ${adminCount} admin account${adminCount === 1 ? " is" : "s are"} still assigned to it.`
    )
  }

  await query(
    `
      DELETE FROM public.todas
      WHERE toda_id = $1
    `,
    [todaId]
  )
}

export const createDriver = async (input: CreateDriverInput) => {
  await ensureDatabaseReady()

  const driverId = await withTransaction(async (client) => {
    const result = await client.query<{ driver_id: number }>(
      `
        INSERT INTO public.drivers (
          toda_id,
          tricycle_id,
          first_name,
          last_name,
          contact_no
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING driver_id
      `,
      [
        input.todaId,
        input.tricycleId ?? null,
        input.firstName,
        input.lastName,
        input.contactNo ?? null
      ]
    )

    const nextDriverId = result.rows[0]?.driver_id
    if (!nextDriverId) {
      throw new Error("Unable to create driver.")
    }

    await ensureDriverQrCode(
      client,
      Number(nextDriverId),
      input.tricycleId === undefined ? null : input.tricycleId
    )

    return Number(nextDriverId)
  })

  return getDriverById(driverId)
}

export const updateDriver = async (driverId: number, input: UpdateDriverInput) => {
  await ensureDatabaseReady()

  await withTransaction(async (client) => {
    await client.query(
      `
        UPDATE public.drivers
        SET toda_id = CASE WHEN $2 THEN $3 ELSE toda_id END,
            tricycle_id = CASE WHEN $4 THEN $5 ELSE tricycle_id END,
            first_name = CASE WHEN $6 THEN $7 ELSE first_name END,
            last_name = CASE WHEN $8 THEN $9 ELSE last_name END,
            contact_no = CASE WHEN $10 THEN $11 ELSE contact_no END,
            status = CASE WHEN $12 THEN $13 ELSE status END
        WHERE driver_id = $1
      `,
      [
        driverId,
        hasOwn(input, "todaId"),
        input.todaId ?? null,
        hasOwn(input, "tricycleId"),
        input.tricycleId ?? null,
        hasOwn(input, "firstName"),
        input.firstName ?? null,
        hasOwn(input, "lastName"),
        input.lastName ?? null,
        hasOwn(input, "contactNo"),
        input.contactNo ?? null,
        hasOwn(input, "status"),
        input.status ?? null
      ]
    )

    const tricycleResult = await client.query<{ tricycle_id: number | null }>(
      `
        SELECT tricycle_id
        FROM public.drivers
        WHERE driver_id = $1
        LIMIT 1
      `,
      [driverId]
    )

    const tricycleId = tricycleResult.rows[0]?.tricycle_id ?? null

    if (input.regenerateQr) {
      await regenerateDriverQrCode(
        client,
        driverId,
        tricycleId === null ? null : Number(tricycleId)
      )
      return
    }

    await ensureDriverQrCode(
      client,
      driverId,
      tricycleId === null ? null : Number(tricycleId)
    )
  })

  return getDriverById(driverId)
}

export const deleteDriver = async (driverId: number) => {
  await ensureDatabaseReady()

  await query(
    `
      DELETE FROM public.drivers
      WHERE driver_id = $1
    `,
    [driverId]
  )
}

export const createTricycle = async (input: CreateTricycleInput) => {
  await ensureDatabaseReady()

  const result = await query<{ tricycle_id: number }>(
    `
      INSERT INTO public.tricycles (toda_id, plate_no, reg_no, permit_expiration_date)
      VALUES ($1, $2, $3, $4)
      RETURNING tricycle_id
    `,
    [
      input.todaId,
      input.plateNo,
      input.regNo ?? null,
      input.permitExpirationDate ?? null
    ]
  )

  return getTricycleById(result.rows[0].tricycle_id)
}

export const updateTricycle = async (
  tricycleId: number,
  input: UpdateTricycleInput
) => {
  await ensureDatabaseReady()

  await query(
    `
      UPDATE public.tricycles
      SET toda_id = CASE WHEN $2 THEN $3 ELSE toda_id END,
          plate_no = CASE WHEN $4 THEN $5 ELSE plate_no END,
          reg_no = CASE WHEN $6 THEN $7 ELSE reg_no END,
          permit_expiration_date = CASE WHEN $8 THEN $9::date ELSE permit_expiration_date END,
          status = CASE WHEN $10 THEN $11 ELSE status END
      WHERE tricycle_id = $1
    `,
    [
      tricycleId,
      hasOwn(input, "todaId"),
      input.todaId ?? null,
      hasOwn(input, "plateNo"),
      input.plateNo ?? null,
      hasOwn(input, "regNo"),
      input.regNo ?? null,
      hasOwn(input, "permitExpirationDate"),
      input.permitExpirationDate ?? null,
      hasOwn(input, "status"),
      input.status ?? null
    ]
  )

  return getTricycleById(tricycleId)
}

export const deleteTricycle = async (tricycleId: number) => {
  await ensureDatabaseReady()

  await query(
    `
      DELETE FROM public.tricycles
      WHERE tricycle_id = $1
    `,
    [tricycleId]
  )
}

export const createRoute = async (input: CreateRouteInput) => {
  await ensureDatabaseReady()

  const result = await query<{ route_id: number }>(
    `
      INSERT INTO public.routes (
        toda_id,
        origin,
        destination,
        default_fare_amount,
        geofence_geojson
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING route_id
    `,
    [
      input.todaId,
      input.origin,
      input.destination,
      input.defaultFareAmount ?? null,
      input.geofenceGeojson === undefined ? null : JSON.stringify(input.geofenceGeojson)
    ]
  )

  return getRouteById(result.rows[0].route_id)
}

export const updateRoute = async (routeId: number, input: UpdateRouteInput) => {
  await ensureDatabaseReady()

  await query(
    `
      UPDATE public.routes
      SET toda_id = COALESCE($2, toda_id),
          origin = COALESCE($3, origin),
          destination = COALESCE($4, destination),
          default_fare_amount = CASE
            WHEN $5 THEN $6::numeric
            ELSE default_fare_amount
          END,
          geofence_geojson = CASE
            WHEN $7 THEN $8::jsonb
            ELSE geofence_geojson
          END,
          status = COALESCE($9, status)
      WHERE route_id = $1
    `,
    [
      routeId,
      input.todaId ?? null,
      input.origin ?? null,
      input.destination ?? null,
      hasOwn(input, "defaultFareAmount"),
      input.defaultFareAmount ?? null,
      hasOwn(input, "geofenceGeojson"),
      input.geofenceGeojson === undefined || input.geofenceGeojson === null
        ? null
        : JSON.stringify(input.geofenceGeojson),
      input.status ?? null
    ]
  )

  return getRouteById(routeId)
}

export const deleteRoute = async (routeId: number) => {
  await ensureDatabaseReady()

  const { rows } = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM public.trips
      WHERE route_id = $1
    `,
    [routeId]
  )

  const tripCount = Number(rows[0]?.count ?? "0")

  if (tripCount > 0) {
    throw new Error(
      `Cannot delete route while ${tripCount} trip${tripCount === 1 ? " is" : "s are"} still linked to it.`
    )
  }

  await query(
    `
      DELETE FROM public.routes
      WHERE route_id = $1
    `,
    [routeId]
  )
}
