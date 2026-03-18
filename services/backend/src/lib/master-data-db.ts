import type { AdminProfile } from "./admin-auth-db"
import { ensureDatabaseReady, query } from "./database"

export type EntityStatus = "active" | "inactive" | "suspended"

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
  geofenceGeojson?: unknown
  status: EntityStatus
  createdAt: string
}

export type MasterDataSnapshot = {
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
  qrId?: number
  firstName: string
  lastName: string
  contactNo?: string
}

export type UpdateDriverInput = {
  todaId?: number
  tricycleId?: number | null
  qrId?: number | null
  firstName?: string
  lastName?: string
  contactNo?: string | null
  status?: EntityStatus
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
  geofenceGeojson?: unknown
}

export type UpdateRouteInput = Partial<CreateRouteInput> & {
  status?: EntityStatus
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
  geofence_geojson: unknown | null
  status: EntityStatus
  created_at: Date
}

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
  geofenceGeojson: row.geofence_geojson ?? undefined,
  status: row.status,
  createdAt: row.created_at.toISOString()
})

const hasOwn = <T extends object>(value: T, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(value, key)

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
`

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
    r.geofence_geojson,
    r.status,
    r.created_at
  FROM public.routes r
  JOIN public.todas t
    ON t.toda_id = r.toda_id
  JOIN public.barangays b
    ON b.barangay_id = t.barangay_id
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

export const listMasterData = async (): Promise<MasterDataSnapshot> => {
  await ensureDatabaseReady()

  const [barangays, todas, drivers, tricycles, routes] = await Promise.all([
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

  return {
    barangays: barangays.rows.map(mapBarangay),
    todas: todas.rows.map(mapToda),
    drivers: drivers.rows.map(mapDriver),
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

  const barangayScope = buildScopeClause(profile, "t.toda_id", "b.barangay_id")
  const todaScope = buildScopeClause(profile, "t.toda_id", "b.barangay_id")
  const driverScope = buildScopeClause(profile, "d.toda_id", "b.barangay_id")
  const tricycleScope = buildScopeClause(profile, "tr.toda_id", "b.barangay_id")
  const routeScope = buildScopeClause(profile, "r.toda_id", "b.barangay_id")

  const [barangays, todas, drivers, tricycles, routes] = await Promise.all([
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

  return {
    barangays: barangays.rows.map(mapBarangay),
    todas: todas.rows.map(mapToda),
    drivers: drivers.rows.map(mapDriver),
    tricycles: tricycles.rows.map(mapTricycle),
    routes: routes.rows.map(mapRoute)
  }
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

export const createDriver = async (input: CreateDriverInput) => {
  await ensureDatabaseReady()

  const result = await query<{ driver_id: number }>(
    `
      INSERT INTO public.drivers (
        toda_id,
        tricycle_id,
        qr_id,
        first_name,
        last_name,
        contact_no
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING driver_id
    `,
    [
      input.todaId,
      input.tricycleId ?? null,
      input.qrId ?? null,
      input.firstName,
      input.lastName,
      input.contactNo ?? null
    ]
  )

  return getDriverById(result.rows[0].driver_id)
}

export const updateDriver = async (driverId: number, input: UpdateDriverInput) => {
  await ensureDatabaseReady()

  await query(
    `
      UPDATE public.drivers
      SET toda_id = CASE WHEN $2 THEN $3 ELSE toda_id END,
          tricycle_id = CASE WHEN $4 THEN $5 ELSE tricycle_id END,
          qr_id = CASE WHEN $6 THEN $7 ELSE qr_id END,
          first_name = CASE WHEN $8 THEN $9 ELSE first_name END,
          last_name = CASE WHEN $10 THEN $11 ELSE last_name END,
          contact_no = CASE WHEN $12 THEN $13 ELSE contact_no END,
          status = CASE WHEN $14 THEN $15 ELSE status END
      WHERE driver_id = $1
    `,
    [
      driverId,
      hasOwn(input, "todaId"),
      input.todaId ?? null,
      hasOwn(input, "tricycleId"),
      input.tricycleId ?? null,
      hasOwn(input, "qrId"),
      input.qrId ?? null,
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
      INSERT INTO public.routes (toda_id, origin, destination, geofence_geojson)
      VALUES ($1, $2, $3, $4)
      RETURNING route_id
    `,
    [
      input.todaId,
      input.origin,
      input.destination,
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
          geofence_geojson = CASE
            WHEN $5::jsonb is null THEN geofence_geojson
            ELSE $5
          END,
          status = COALESCE($6, status)
      WHERE route_id = $1
    `,
    [
      routeId,
      input.todaId ?? null,
      input.origin ?? null,
      input.destination ?? null,
      input.geofenceGeojson === undefined ? null : JSON.stringify(input.geofenceGeojson),
      input.status ?? null
    ]
  )

  return getRouteById(routeId)
}
