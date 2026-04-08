import { randomUUID } from "crypto"

const SUPABASE_URL = process.env.SUPABASE_URL?.trim()
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const PASSENGER_REPORT_MEDIA_BUCKET = (
  process.env.SUPABASE_REPORT_MEDIA_BUCKET ?? "passenger-report-media"
).trim()

const ensureStorageConfig = () => {
  if (!SUPABASE_URL) {
    throw new Error("Missing SUPABASE_URL in backend environment.")
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY in backend environment. Passenger proof uploads require a Supabase service role key."
    )
  }
}

const encodePath = (value: string) =>
  value
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/")

const resolveFileExtension = (mimeType: string, fileName?: string) => {
  const fileExtension = fileName?.split(".").pop()?.trim().toLowerCase()
  if (fileExtension) {
    return fileExtension === "jpeg" ? "jpg" : fileExtension
  }

  switch (mimeType.trim().toLowerCase()) {
    case "image/jpeg":
      return "jpg"
    case "image/png":
      return "png"
    case "image/webp":
      return "webp"
    default:
      return "bin"
  }
}

const decodeDataUrlPayload = (dataUrl: string, mimeType: string) => {
  const prefix = `data:${mimeType};base64,`
  if (!dataUrl.startsWith(prefix)) {
    throw new Error("Evidence image payload is invalid.")
  }

  return Buffer.from(dataUrl.slice(prefix.length), "base64")
}

const buildStorageErrorMessage = async (response: Response) => {
  const text = await response.text()
  if (!text) {
    return `Supabase Storage returned HTTP ${response.status}.`
  }

  try {
    const parsed = JSON.parse(text) as {
      message?: string
      error?: string
      statusCode?: string | number
    }
    return parsed.message ?? parsed.error ?? `Supabase Storage returned HTTP ${response.status}.`
  } catch {
    return text
  }
}

export type UploadedPassengerEvidence = {
  objectPath: string
  publicUrl: string
}

export const uploadPassengerReportEvidence = async (params: {
  reportId: number
  driverId: number
  mimeType: string
  dataUrl: string
  fileName?: string
}): Promise<UploadedPassengerEvidence> => {
  ensureStorageConfig()

  const extension = resolveFileExtension(params.mimeType, params.fileName)
  const objectPath = `report-${params.reportId}/driver-${params.driverId}-${randomUUID()}.${extension}`
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(
    PASSENGER_REPORT_MEDIA_BUCKET
  )}/${encodePath(objectPath)}`
  const fileBytes = decodeDataUrlPayload(params.dataUrl, params.mimeType)

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      "Content-Type": params.mimeType,
      "x-upsert": "true"
    },
    body: fileBytes
  })

  if (!response.ok) {
    const message = await buildStorageErrorMessage(response)
    if (/bucket.*not found/i.test(message)) {
      throw new Error(
        `Passenger proof upload bucket \`${PASSENGER_REPORT_MEDIA_BUCKET}\` was not found. Create it in Supabase Storage before accepting image uploads.`
      )
    }

    throw new Error(`Unable to upload passenger proof image. ${message}`)
  }

  return {
    objectPath,
    publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(
      PASSENGER_REPORT_MEDIA_BUCKET
    )}/${encodePath(objectPath)}`
  }
}

export const deletePassengerReportEvidence = async (objectPath: string) => {
  ensureStorageConfig()

  await fetch(
    `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(
      PASSENGER_REPORT_MEDIA_BUCKET
    )}/${encodePath(objectPath)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY!
      }
    }
  )
}
