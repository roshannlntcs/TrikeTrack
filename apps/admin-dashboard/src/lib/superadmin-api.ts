import { getSnapshot, saveSnapshot, type CachedSnapshot } from "./db"

export type EntityStatus = "active" | "inactive" | "suspended"
export type AdministratorRole = "superadmin" | "barangay_admin" | "toda_admin"

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
  qrStatus?: "active" | "inactive" | "revoked" | "expired"
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
  geofenceGeojson?: unknown
  status: EntityStatus
  createdAt: string
}

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

export type MasterDataSnapshot = {
  administrators: AdministratorRecord[]
  barangays: BarangayRecord[]
  todas: TodaRecord[]
  drivers: DriverRecord[]
  tricycles: TricycleRecord[]
  routes: RouteRecord[]
  cacheMeta?: {
    fromCache: boolean
    savedAt: string
  }
}

export type EntityType =
  | "administrator"
  | "barangay"
  | "toda"
  | "driver"
  | "tricycle"
  | "route"

type MasterDataResponse = {
  ok?: boolean
  message?: string
  data?: MasterDataSnapshot
  item?: unknown
}

const MASTER_DATA_CACHE_KEY = "master-data"

const withCacheMeta = <TData extends object>(cached: CachedSnapshot<TData>) => ({
  ...cached.data,
  cacheMeta: {
    fromCache: true,
    savedAt: new Date(cached.savedAt).toISOString()
  }
})

const parseError = async (response: Response) => {
  const payload = (await response.json().catch(() => ({}))) as MasterDataResponse
  return payload.message ?? `HTTP ${response.status}`
}

const request = async <T>(
  accessToken: string,
  init: RequestInit
): Promise<T> => {
  const response = await fetch("/api/admin/master-data", {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {})
    }
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return (await response.json()) as T
}

export const fetchMasterData = async (accessToken: string) => {
  try {
    const response = await request<MasterDataResponse>(accessToken, { method: "GET" })
    if (!response.data) {
      throw new Error("Master data response was missing data.")
    }
    await saveSnapshot(MASTER_DATA_CACHE_KEY, response.data)
    return response.data
  } catch (error) {
    const cached = await getSnapshot<MasterDataSnapshot>(MASTER_DATA_CACHE_KEY)
    if (cached) {
      return withCacheMeta(cached)
    }
    throw error
  }
}

export const createMasterDataItem = async <TItem>(
  accessToken: string,
  entity: EntityType,
  payload: Record<string, unknown>
) => {
  const response = await request<MasterDataResponse>(accessToken, {
    method: "POST",
    body: JSON.stringify({ entity, payload })
  })

  return response.item as TItem
}

export const updateMasterDataItem = async <TItem>(
  accessToken: string,
  entity: EntityType,
  id: number,
  payload: Record<string, unknown>
) => {
  const response = await request<MasterDataResponse>(accessToken, {
    method: "PATCH",
    body: JSON.stringify({ entity, id, payload })
  })

  return response.item as TItem
}

export const deleteMasterDataItem = async (
  accessToken: string,
  entity: EntityType,
  id: number
) => {
  await request<MasterDataResponse>(accessToken, {
    method: "DELETE",
    body: JSON.stringify({ entity, id })
  })
}
