import { ensureDatabaseReady, query } from "./database"

const normalizeDriverIdentifier = (value: string) => value.trim().toUpperCase()

export const resolveDriverIdFromIdentifier = async (identifier: string) => {
  await ensureDatabaseReady()

  const normalized = normalizeDriverIdentifier(identifier)
  if (!normalized) return null

  const result = await query<{ driver_id: number }>(
    `
      SELECT d.driver_id
      FROM public.drivers d
      WHERE upper(d.driver_code) = $1
         OR d.driver_id::text = $1
      LIMIT 1
    `,
    [normalized]
  )

  const driverId = result.rows[0]?.driver_id
  return driverId === undefined ? null : Number(driverId)
}
