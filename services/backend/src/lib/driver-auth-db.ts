import { query } from "./database"
import { resolveDriverIdFromIdentifier } from "./driver-identifier-db"
import { hashPassword, verifyPassword } from "./password-hash"

export type DriverAppProfile = {
  driverId: number
  driverCode: string
  firstName: string
  lastName: string
  todaId: number
  todaName: string
  barangayName: string
  tricycleId?: number
  tricycleNo?: string
  qrId?: number
  status: "active" | "inactive" | "suspended"
}

type DriverAuthRow = {
  driver_id: number
  driver_code: string
  first_name: string
  last_name: string
  toda_id: number
  toda_name: string
  barangay_name: string
  tricycle_id: number | null
  plate_no: string | null
  qr_id: number | null
  password_hash: string | null
  status: DriverAppProfile["status"]
}

const mapDriverAppProfile = (row: DriverAuthRow): DriverAppProfile => ({
  driverId: Number(row.driver_id),
  driverCode: row.driver_code,
  firstName: row.first_name,
  lastName: row.last_name,
  todaId: Number(row.toda_id),
  todaName: row.toda_name,
  barangayName: row.barangay_name,
  tricycleId: row.tricycle_id === null ? undefined : Number(row.tricycle_id),
  tricycleNo: row.plate_no ?? undefined,
  qrId: row.qr_id === null ? undefined : Number(row.qr_id),
  status: row.status
})

const getDriverAuthRow = async (driverIdentifier: string) => {
  const driverId = await resolveDriverIdFromIdentifier(driverIdentifier)
  if (!driverId) return null

  const result = await query<DriverAuthRow>(
    `
      SELECT
        d.driver_id,
        d.driver_code,
        d.first_name,
        d.last_name,
        d.toda_id,
        t.toda_name,
        b.barangay_name,
        d.tricycle_id,
        tr.plate_no,
        d.qr_id,
        d.password_hash,
        d.status
      FROM public.drivers d
      JOIN public.todas t
        ON t.toda_id = d.toda_id
      JOIN public.barangays b
        ON b.barangay_id = t.barangay_id
      LEFT JOIN public.tricycles tr
        ON tr.tricycle_id = d.tricycle_id
      WHERE d.driver_id = $1
      LIMIT 1
    `,
    [driverId]
  )

  return result.rows[0] ?? null
}

export const setupDriverPassword = async (driverIdentifier: string, password: string) => {
  const driver = await getDriverAuthRow(driverIdentifier)
  if (!driver) {
    return { profile: null, error: "DRIVER_NOT_FOUND" as const }
  }
  if (driver.status !== "active") {
    return { profile: null, error: "DRIVER_NOT_ACTIVE" as const }
  }
  if (driver.password_hash) {
    return { profile: null, error: "PASSWORD_ALREADY_SET" as const }
  }

  await query(
    `
      UPDATE public.drivers
      SET password_hash = $2
      WHERE driver_id = $1
    `,
    [driver.driver_id, hashPassword(password)]
  )

  const updated = await getDriverAuthRow(String(driver.driver_id))
  return {
    profile: updated ? mapDriverAppProfile(updated) : null,
    error: null as null
  }
}

export const loginDriver = async (driverIdentifier: string, password: string) => {
  const driver = await getDriverAuthRow(driverIdentifier)
  if (!driver) {
    return { profile: null, error: "DRIVER_NOT_FOUND" as const }
  }
  if (driver.status !== "active") {
    return { profile: null, error: "DRIVER_NOT_ACTIVE" as const }
  }
  if (!driver.password_hash) {
    return { profile: null, error: "PASSWORD_NOT_SET" as const }
  }
  if (!verifyPassword(password, driver.password_hash)) {
    return { profile: null, error: "INVALID_CREDENTIALS" as const }
  }

  return {
    profile: mapDriverAppProfile(driver),
    error: null as null
  }
}
