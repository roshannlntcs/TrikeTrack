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

export type EntityType = "barangay" | "toda" | "driver" | "tricycle" | "route"

type MasterDataResponse = {
  ok?: boolean
  message?: string
  data?: MasterDataSnapshot
  item?: unknown
}

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
  const response = await request<MasterDataResponse>(accessToken, { method: "GET" })
  if (!response.data) {
    throw new Error("Master data response was missing data.")
  }
  return response.data
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
  entity: Extract<EntityType, "driver" | "tricycle">,
  id: number
) => {
  await request<MasterDataResponse>(accessToken, {
    method: "DELETE",
    body: JSON.stringify({ entity, id })
  })
}
