import { NextResponse } from "next/server"
import { requireAdminSession } from "../../../../lib/admin-session"
import {
  createBarangay,
  createDriver,
  createRoute,
  createToda,
  createTricycle,
  deleteBarangay,
  deleteDriver,
  deleteRoute,
  deleteToda,
  deleteTricycle,
  getDriverById,
  getTricycleById,
  listMasterDataForAdmin,
  updateBarangay,
  updateDriver,
  updateRoute,
  updateToda,
  updateTricycle,
  type CreateBarangayInput,
  type CreateDriverInput,
  type CreateRouteInput,
  type CreateTodaInput,
  type CreateTricycleInput,
  type EntityStatus,
  type UpdateBarangayInput,
  type UpdateDriverInput,
  type UpdateRouteInput,
  type UpdateTodaInput,
  type UpdateTricycleInput
} from "../../../../lib/master-data-db"

type EntityType = "barangay" | "toda" | "driver" | "tricycle" | "route"

const ENTITY_STATUS_VALUES = new Set<EntityStatus>(["active", "inactive", "suspended"])

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const asNonEmptyString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null

const asOptionalString = (value: unknown) => {
  if (value === undefined) return undefined
  if (value === null) return ""
  return typeof value === "string" ? value.trim() : null
}

const asPositiveInteger = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

const asOptionalPositiveInteger = (value: unknown) => {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  return asPositiveInteger(value)
}

const asEntityStatus = (value: unknown) =>
  typeof value === "string" && ENTITY_STATUS_VALUES.has(value as EntityStatus)
    ? (value as EntityStatus)
    : null

const parseEntity = (value: unknown): EntityType | null => {
  return value === "barangay" ||
    value === "toda" ||
    value === "driver" ||
    value === "tricycle" ||
    value === "route"
    ? value
    : null
}

const invalid = (message: string, status = 400) =>
  NextResponse.json({ ok: false, message }, { status })

const SUPERADMIN_ENTITIES = new Set<EntityType>(["barangay", "toda", "route"])
const TODA_ADMIN_ENTITIES = new Set<EntityType>(["driver", "tricycle"])

const requireMasterDataSession = async (request: Request) => {
  const session = await requireAdminSession(request)
  if (session.response) return session

  if (session.profile.role === "superadmin" || session.profile.role === "toda_admin") {
    return session
  }

  return {
    response: NextResponse.json(
      {
        ok: false,
        message: "This action requires a superadmin or TODA admin account."
      },
      { status: 403 }
    )
  }
}

const ensureEntityPermission = (
  role: "superadmin" | "barangay_admin" | "toda_admin",
  entity: EntityType
) => {
  if (role === "superadmin" && SUPERADMIN_ENTITIES.has(entity)) return null
  if (role === "toda_admin" && TODA_ADMIN_ENTITIES.has(entity)) return null

  return NextResponse.json(
    {
      ok: false,
      message:
        role === "superadmin"
          ? "Superadmin can manage barangays, TODAs, and routes only."
          : "TODA admin can manage drivers and tricycles only."
    },
    { status: 403 }
  )
}

const ensureTodaScopedCreate = (
  todaId: number | undefined,
  profileTodaId: number | undefined
) => {
  const normalizedTodaId = todaId === undefined ? undefined : Number(todaId)
  const normalizedProfileTodaId =
    profileTodaId === undefined ? undefined : Number(profileTodaId)

  if (
    !normalizedProfileTodaId ||
    !normalizedTodaId ||
    normalizedTodaId !== normalizedProfileTodaId
  ) {
    return invalid("You can only manage records for your assigned TODA.", 403)
  }
  return null
}

const ensureTodaScopedUpdate = async (
  entity: "driver" | "tricycle",
  id: number,
  nextTodaId: number | undefined,
  profileTodaId: number | undefined
) => {
  const normalizedNextTodaId =
    nextTodaId === undefined ? undefined : Number(nextTodaId)
  const normalizedProfileTodaId =
    profileTodaId === undefined ? undefined : Number(profileTodaId)

  if (!normalizedProfileTodaId) {
    return invalid("This TODA admin account is missing an assigned TODA.", 403)
  }

  if (
    normalizedNextTodaId !== undefined &&
    normalizedNextTodaId !== normalizedProfileTodaId
  ) {
    return invalid("You can only manage records for your assigned TODA.", 403)
  }

  const existing =
    entity === "driver" ? await getDriverById(id) : await getTricycleById(id)

  if (Number(existing.todaId) !== normalizedProfileTodaId) {
    return invalid("You can only update records that belong to your assigned TODA.", 403)
  }

  return null
}

const parseCreateBarangay = (payload: Record<string, unknown>): CreateBarangayInput | null => {
  const barangayName = asNonEmptyString(payload.barangayName)
  const city = asNonEmptyString(payload.city)
  const district = asOptionalString(payload.district)
  if (!barangayName || !city || district === null) return null
  return {
    barangayName,
    city,
    district: district || undefined
  }
}

const parseUpdateBarangay = (payload: Record<string, unknown>): UpdateBarangayInput | null => {
  const next: UpdateBarangayInput = {}
  if ("barangayName" in payload) {
    const barangayName = asNonEmptyString(payload.barangayName)
    if (!barangayName) return null
    next.barangayName = barangayName
  }
  if ("district" in payload) {
    const district = asOptionalString(payload.district)
    if (district === null) return null
    next.district = district || undefined
  }
  if ("city" in payload) {
    const city = asNonEmptyString(payload.city)
    if (!city) return null
    next.city = city
  }
  if ("status" in payload) {
    const status = asEntityStatus(payload.status)
    if (!status) return null
    next.status = status
  }
  return Object.keys(next).length > 0 ? next : null
}

const parseCreateToda = (payload: Record<string, unknown>): CreateTodaInput | null => {
  const barangayId = asPositiveInteger(payload.barangayId)
  const todaName = asNonEmptyString(payload.todaName)
  if (!barangayId || !todaName) return null
  return { barangayId, todaName }
}

const parseUpdateToda = (payload: Record<string, unknown>): UpdateTodaInput | null => {
  const next: UpdateTodaInput = {}
  if ("barangayId" in payload) {
    const barangayId = asPositiveInteger(payload.barangayId)
    if (!barangayId) return null
    next.barangayId = barangayId
  }
  if ("todaName" in payload) {
    const todaName = asNonEmptyString(payload.todaName)
    if (!todaName) return null
    next.todaName = todaName
  }
  if ("status" in payload) {
    const status = asEntityStatus(payload.status)
    if (!status) return null
    next.status = status
  }
  return Object.keys(next).length > 0 ? next : null
}

const parseCreateDriver = (payload: Record<string, unknown>): CreateDriverInput | null => {
  const todaId = asPositiveInteger(payload.todaId)
  const tricycleId =
    payload.tricycleId === undefined ? undefined : asPositiveInteger(payload.tricycleId)
  const firstName = asNonEmptyString(payload.firstName)
  const lastName = asNonEmptyString(payload.lastName)
  const contactNo = asOptionalString(payload.contactNo)
  if (!todaId || !firstName || !lastName || contactNo === null) return null
  if (payload.tricycleId !== undefined && !tricycleId) return null
  return {
    todaId,
    tricycleId: tricycleId ?? undefined,
    firstName,
    lastName,
    contactNo: contactNo || undefined
  }
}

const parseUpdateDriver = (payload: Record<string, unknown>): UpdateDriverInput | null => {
  const next: UpdateDriverInput = {}
  if ("todaId" in payload) {
    const todaId = asPositiveInteger(payload.todaId)
    if (!todaId) return null
    next.todaId = todaId
  }
  if ("tricycleId" in payload) {
    const tricycleId = asOptionalPositiveInteger(payload.tricycleId)
    if (tricycleId === undefined) return null
    next.tricycleId = tricycleId
  }
  if ("firstName" in payload) {
    const firstName = asNonEmptyString(payload.firstName)
    if (!firstName) return null
    next.firstName = firstName
  }
  if ("lastName" in payload) {
    const lastName = asNonEmptyString(payload.lastName)
    if (!lastName) return null
    next.lastName = lastName
  }
  if ("contactNo" in payload) {
    const contactNo = asOptionalString(payload.contactNo)
    if (contactNo === null) return null
    next.contactNo = contactNo || null
  }
  if ("status" in payload) {
    const status = asEntityStatus(payload.status)
    if (!status) return null
    next.status = status
  }
  if ("regenerateQr" in payload) {
    if (typeof payload.regenerateQr !== "boolean") return null
    next.regenerateQr = payload.regenerateQr
  }
  return Object.keys(next).length > 0 ? next : null
}

const parseCreateTricycle = (payload: Record<string, unknown>): CreateTricycleInput | null => {
  const todaId = asPositiveInteger(payload.todaId)
  const plateNo = asNonEmptyString(payload.plateNo)
  const regNo = asOptionalString(payload.regNo)
  const permitExpirationDate = asOptionalString(payload.permitExpirationDate)
  if (!todaId || !plateNo || regNo === null || permitExpirationDate === null) return null
  return {
    todaId,
    plateNo,
    regNo: regNo || undefined,
    permitExpirationDate: permitExpirationDate || undefined
  }
}

const parseUpdateTricycle = (payload: Record<string, unknown>): UpdateTricycleInput | null => {
  const next: UpdateTricycleInput = {}
  if ("todaId" in payload) {
    const todaId = asPositiveInteger(payload.todaId)
    if (!todaId) return null
    next.todaId = todaId
  }
  if ("plateNo" in payload) {
    const plateNo = asNonEmptyString(payload.plateNo)
    if (!plateNo) return null
    next.plateNo = plateNo
  }
  if ("regNo" in payload) {
    const regNo = asOptionalString(payload.regNo)
    if (regNo === null) return null
    next.regNo = regNo || null
  }
  if ("permitExpirationDate" in payload) {
    const permitExpirationDate = asOptionalString(payload.permitExpirationDate)
    if (permitExpirationDate === null) return null
    next.permitExpirationDate = permitExpirationDate || null
  }
  if ("status" in payload) {
    const status = asEntityStatus(payload.status)
    if (!status) return null
    next.status = status
  }
  return Object.keys(next).length > 0 ? next : null
}

const parseCreateRoute = (payload: Record<string, unknown>): CreateRouteInput | null => {
  const todaId = asPositiveInteger(payload.todaId)
  const origin = asNonEmptyString(payload.origin)
  const destination = asNonEmptyString(payload.destination)
  if (!todaId || !origin || !destination) return null
  return {
    todaId,
    origin,
    destination,
    geofenceGeojson: payload.geofenceGeojson
  }
}

const parseUpdateRoute = (payload: Record<string, unknown>): UpdateRouteInput | null => {
  const next: UpdateRouteInput = {}
  if ("todaId" in payload) {
    const todaId = asPositiveInteger(payload.todaId)
    if (!todaId) return null
    next.todaId = todaId
  }
  if ("origin" in payload) {
    const origin = asNonEmptyString(payload.origin)
    if (!origin) return null
    next.origin = origin
  }
  if ("destination" in payload) {
    const destination = asNonEmptyString(payload.destination)
    if (!destination) return null
    next.destination = destination
  }
  if ("geofenceGeojson" in payload) {
    next.geofenceGeojson = payload.geofenceGeojson
  }
  if ("status" in payload) {
    const status = asEntityStatus(payload.status)
    if (!status) return null
    next.status = status
  }
  return Object.keys(next).length > 0 ? next : null
}

const toErrorResponse = (error: unknown) => {
  const pgError = error as { code?: string; detail?: string; message?: string } | undefined
  const message = pgError?.detail || pgError?.message || "Master data operation failed."
  const status =
    pgError?.code === "23505" || pgError?.code === "23503"
      ? 409
      : 400
  return NextResponse.json({ ok: false, message }, { status })
}

export async function GET(request: Request) {
  const session = await requireMasterDataSession(request)
  if (session.response) return session.response

  try {
    const data = await listMasterDataForAdmin(session.profile)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const session = await requireMasterDataSession(request)
  if (session.response) return session.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalid("Request body must be valid JSON.")
  }

  if (!isObject(body)) return invalid("Expected a JSON object body.")

  const entity = parseEntity(body.entity)
  const payload = isObject(body.payload) ? body.payload : null
  if (!entity || !payload) {
    return invalid("Expected { entity, payload }.")
  }

  const entityPermissionError = ensureEntityPermission(session.profile.role, entity)
  if (entityPermissionError) return entityPermissionError

  try {
    switch (entity) {
      case "barangay": {
        const parsed = parseCreateBarangay(payload)
        if (!parsed) return invalid("Invalid barangay payload.")
        return NextResponse.json({ ok: true, item: await createBarangay(parsed) })
      }
      case "toda": {
        const parsed = parseCreateToda(payload)
        if (!parsed) return invalid("Invalid TODA payload.")
        return NextResponse.json({ ok: true, item: await createToda(parsed) })
      }
      case "driver": {
        const parsed = parseCreateDriver(payload)
        if (!parsed) return invalid("Invalid driver payload.")
        if (session.profile.role === "toda_admin") {
          const scopeError = ensureTodaScopedCreate(parsed.todaId, session.profile.todaId)
          if (scopeError) return scopeError
        }
        return NextResponse.json({ ok: true, item: await createDriver(parsed) })
      }
      case "tricycle": {
        const parsed = parseCreateTricycle(payload)
        if (!parsed) return invalid("Invalid tricycle payload.")
        if (session.profile.role === "toda_admin") {
          const scopeError = ensureTodaScopedCreate(parsed.todaId, session.profile.todaId)
          if (scopeError) return scopeError
        }
        return NextResponse.json({ ok: true, item: await createTricycle(parsed) })
      }
      case "route": {
        const parsed = parseCreateRoute(payload)
        if (!parsed) return invalid("Invalid route payload.")
        return NextResponse.json({ ok: true, item: await createRoute(parsed) })
      }
    }
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  const session = await requireMasterDataSession(request)
  if (session.response) return session.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalid("Request body must be valid JSON.")
  }

  if (!isObject(body)) return invalid("Expected a JSON object body.")

  const entity = parseEntity(body.entity)
  const id = asPositiveInteger(body.id)
  const payload = isObject(body.payload) ? body.payload : null
  if (!entity || !id || !payload) {
    return invalid("Expected { entity, id, payload }.")
  }

  const entityPermissionError = ensureEntityPermission(session.profile.role, entity)
  if (entityPermissionError) return entityPermissionError

  try {
    switch (entity) {
      case "barangay": {
        const parsed = parseUpdateBarangay(payload)
        if (!parsed) return invalid("Invalid barangay update payload.")
        return NextResponse.json({ ok: true, item: await updateBarangay(id, parsed) })
      }
      case "toda": {
        const parsed = parseUpdateToda(payload)
        if (!parsed) return invalid("Invalid TODA update payload.")
        return NextResponse.json({ ok: true, item: await updateToda(id, parsed) })
      }
      case "driver": {
        const parsed = parseUpdateDriver(payload)
        if (!parsed) return invalid("Invalid driver update payload.")
        if (session.profile.role === "toda_admin") {
          const scopeError = await ensureTodaScopedUpdate(
            "driver",
            id,
            parsed.todaId,
            session.profile.todaId
          )
          if (scopeError) return scopeError
        }
        return NextResponse.json({ ok: true, item: await updateDriver(id, parsed) })
      }
      case "tricycle": {
        const parsed = parseUpdateTricycle(payload)
        if (!parsed) return invalid("Invalid tricycle update payload.")
        if (session.profile.role === "toda_admin") {
          const scopeError = await ensureTodaScopedUpdate(
            "tricycle",
            id,
            parsed.todaId,
            session.profile.todaId
          )
          if (scopeError) return scopeError
        }
        return NextResponse.json({ ok: true, item: await updateTricycle(id, parsed) })
      }
      case "route": {
        const parsed = parseUpdateRoute(payload)
        if (!parsed) return invalid("Invalid route update payload.")
        return NextResponse.json({ ok: true, item: await updateRoute(id, parsed) })
      }
    }
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  const session = await requireMasterDataSession(request)
  if (session.response) return session.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalid("Request body must be valid JSON.")
  }

  if (!isObject(body)) return invalid("Expected a JSON object body.")

  const entity = parseEntity(body.entity)
  const id = asPositiveInteger(body.id)
  if (!entity || !id) {
    return invalid("Expected { entity, id }.")
  }

  const entityPermissionError = ensureEntityPermission(session.profile.role, entity)
  if (entityPermissionError) return entityPermissionError

  try {
    if (session.profile.role === "toda_admin") {
      if (entity !== "driver" && entity !== "tricycle") {
        return invalid("TODA admin can delete drivers and tricycles only.", 403)
      }

      const scopeError = await ensureTodaScopedUpdate(entity, id, undefined, session.profile.todaId)
      if (scopeError) return scopeError
    }

    switch (entity) {
      case "barangay":
        await deleteBarangay(id)
        break
      case "toda":
        await deleteToda(id)
        break
      case "driver":
        await deleteDriver(id)
        break
      case "tricycle":
        await deleteTricycle(id)
        break
      case "route":
        await deleteRoute(id)
        break
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return toErrorResponse(error)
  }
}
