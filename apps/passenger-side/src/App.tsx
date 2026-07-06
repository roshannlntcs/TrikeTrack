import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  connectPassengerTripStream,
  getPassengerTripView,
  type PassengerTripView
} from "./active-trip-api"
import {
  connectPassengerEmergencyStream,
  createPassengerEmergency,
  getPassengerEmergency,
  type EmergencyAlertRecord
} from "./emergency-api"
import {
  TriketrackMap,
  type TriketrackMapCoordinate
} from "./maps"

type PassengerReportContext = {
  qrId: number
  qrToken: string
  qrStatus?: "active" | "inactive" | "revoked" | "expired"
  qrIsActive?: boolean
  qrIssuedByAdmin?: boolean
  driverId: number
  driverCode: string
  driverName: string
  driverAvatarUrl?: string
  driverStatus: string
  driverCreatedByAdmin?: boolean
  driverIsVerified: boolean
  verificationStatus?: string
  verifiedAt?: string
  verifiedBy?: number
  tricycleId?: number
  plateNo?: string
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  routeId?: number
  tripId?: number
  tripStatus?: "scheduled" | "ongoing" | "completed" | "cancelled"
  tripStartedAt?: string
  tripEndedAt?: string
  routeName?: string
  latestDriverLocation?: {
    latitude: number
    longitude: number
    speed?: number
    heading?: number
    accuracy?: number
    recordedAt: string
    updatedAt?: string
    isOnline: boolean
  }
  fare?: {
    amount?: number
    currency: "PHP"
    label: string
    source: "trip" | "route" | "unavailable"
  }
  reportingAvailable: boolean
  availabilityMessage?: string
}

type ReportTypeRecord = {
  reportTypeId: number
  code: string
  label: string
}

type ReportingPayload = {
  context: PassengerReportContext
  reportTypes: ReportTypeRecord[]
}

type SubmissionPayload = {
  reportId: number
  status: string
}

type EvidenceImage = {
  dataUrl: string
  mimeType: string
  fileName: string
  size: number
}

type CategoryTone = "danger" | "info" | "warning" | "neutral"
type TripTrackingState = "idle" | "loading" | "ready" | "error"

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])
const PRIVATE_IPV4_PATTERN =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/
const ACCEPTED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/quicktime"
])
const MAX_FILE_SIZE = 50 * 1024 * 1024 // Increased to 50MB for videos
const EMERGENCY_STORAGE_PREFIX = "triketrack_passenger_emergency_"

const parseQrToken = () => {
  const parts = window.location.pathname.split("/").filter(Boolean)
  if (parts[0] === "report" && parts[1]) {
    return decodeURIComponent(parts[1])
  }

  const queryToken = new URLSearchParams(window.location.search).get("qrToken")
  return queryToken ? decodeURIComponent(queryToken) : null
}

const parseApiBaseOverride = () => {
  const value = new URLSearchParams(window.location.search).get("apiBase")
  return isNonEmptyString(value) ? value.trim() : null
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

const normalizePublicBaseUrl = (value: string) => {
  try {
    const url = new URL(value.trim().replace(/\\r|\\n/g, ""))
    if (!["http:", "https:"].includes(url.protocol)) {
      return null
    }

    const hostname = url.hostname.toLowerCase()
    if (LOOPBACK_HOSTS.has(hostname) || PRIVATE_IPV4_PATTERN.test(hostname)) {
      return null
    }

    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`
  } catch {
    return null
  }
}

const resolveReportingApiBase = () => {
  const queryOverride = parseApiBaseOverride()
  const configuredValue = [
    import.meta.env.VITE_PUBLIC_BACKEND_BASE_URL,
    import.meta.env.VITE_PUBLIC_API_BASE_URL,
    import.meta.env.VITE_PASSENGER_REPORT_API_BASE_URL,
    import.meta.env.VITE_BACKEND_BASE_URL
  ].find(isNonEmptyString)

  const configuredApiBaseUrl = configuredValue
    ? normalizePublicBaseUrl(configuredValue)
    : null

  if (queryOverride) {
    const normalizedOverride = normalizePublicBaseUrl(queryOverride)
    if (normalizedOverride) {
      return {
        apiBaseUrl: normalizedOverride,
        configuredApiBaseUrl,
        error: null
      }
    }
  }

  if (configuredApiBaseUrl) {
    return {
      apiBaseUrl: configuredApiBaseUrl,
      configuredApiBaseUrl,
      error: null
    }
  }

  if (configuredValue) {
    return {
      apiBaseUrl: null,
      configuredApiBaseUrl: null,
      error:
        "Passenger reporting is not configured correctly. Ask the admin to set VITE_PUBLIC_BACKEND_BASE_URL to a public backend URL."
    }
  }

  if (import.meta.env.DEV) {
    return { apiBaseUrl: "", error: null }
  }

  return {
    apiBaseUrl: null,
    error:
      "Passenger reporting is not configured yet. Ask the admin to set VITE_PUBLIC_BACKEND_BASE_URL to the deployed backend URL."
  }
}

const buildReportingUrl = (apiBaseUrl: string, qrToken?: string) => {
  const endpoint = apiBaseUrl
    ? `${apiBaseUrl.replace(/\/+$/, "")}/api/public/reporting`
    : "/api/public/reporting"

  if (!qrToken) {
    return endpoint
  }

  return `${endpoint}?qrToken=${encodeURIComponent(qrToken)}`
}

const fetchWithTimeout = async (
  url: string,
  options?: RequestInit & { timeout?: number }
): Promise<Response> => {
  const timeout = options?.timeout ?? 10000
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    return response
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const formatBytes = (value: number) => `${(value / (1024 * 1024)).toFixed(1)} MB`

const formatTimestamp = (value?: string) => {
  if (!value) return "Unavailable"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable"
  }

  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  })
}

const formatRelativeTime = (value?: string) => {
  if (!value) return "No recent driver location"

  const parsed = new Date(value)
  const diffMs = Date.now() - parsed.getTime()
  if (!Number.isFinite(diffMs)) {
    return "No recent driver location"
  }

  const diffMinutes = Math.max(0, Math.round(diffMs / 60000))
  if (diffMinutes < 1) return "Updated just now"
  if (diffMinutes === 1) return "Updated 1 minute ago"
  if (diffMinutes < 60) return `Updated ${diffMinutes} minutes ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours === 1) return "Updated 1 hour ago"
  if (diffHours < 24) return `Updated ${diffHours} hours ago`

  const diffDays = Math.round(diffHours / 24)
  return diffDays === 1 ? "Updated 1 day ago" : `Updated ${diffDays} days ago`
}

const formatTripStatus = (status?: PassengerReportContext["tripStatus"]) => {
  switch (status) {
    case "ongoing":
      return "Ongoing"
    case "completed":
      return "Completed"
    case "scheduled":
      return "Scheduled"
    case "cancelled":
      return "Cancelled"
    default:
      return "No active trip"
  }
}

const formatCurrency = (amount?: number, currency = "PHP") => {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return "Unavailable"
  }

  return `${currency} ${amount.toFixed(2)}`
}

const formatDuration = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`
}

const formatDistance = (distanceKilometers?: number) => {
  if (typeof distanceKilometers !== "number" || !Number.isFinite(distanceKilometers) || distanceKilometers < 0) {
    return "Not available"
  }

  return `${distanceKilometers.toFixed(2)} km`
}

const formatSpeed = (speedKph?: number) => {
  if (typeof speedKph !== "number" || !Number.isFinite(speedKph) || speedKph < 0) {
    return "Not available"
  }

  return `${speedKph.toFixed(0)} km/h`
}

const parseFareValue = (value: string) => {
  const normalized = value.replace(/[^0-9.]/g, "")
  if (!normalized) return null

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return parsed
}

const isFreshLocation = (recordedAt?: string) =>
  recordedAt !== undefined &&
  Date.now() - new Date(recordedAt).getTime() <= 5 * 60 * 1000

const hasActiveLiveTrip = (
  trip?: PassengerTripView["trip"] | null
) =>
  Boolean(
    trip &&
      trip.tripStatus === "ongoing" &&
      trip.trackingStatus === "live" &&
      trip.location?.isOnline === true &&
      isFreshLocation(trip.location.recordedAt)
  )

const getCategoryMeta = (
  code: string
): { title: string; description: string; tone: CategoryTone; order: number } => {
  switch (code) {
    case "reckless_driving":
      return {
        title: "Reckless Driving",
        description: "Unsafe driving, speeding, or dangerous maneuvers.",
        tone: "info",
        order: 1
      }
    case "harassment":
      return {
        title: "Harassment",
        description: "Threats, abusive behavior, or inappropriate conduct.",
        tone: "danger",
        order: 2
      }
    case "fare_overpricing":
      return {
        title: "Fare Overpricing",
        description: "Charged more than the expected fare.",
        tone: "warning",
        order: 3
      }
    default:
      return {
        title: "Other",
        description: "Any other safety or conduct concern.",
        tone: "neutral",
        order: 4
      }
  }
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }

      reject(new Error("Unable to read the selected file."))
    }
    reader.onerror = () => reject(new Error("Unable to read the selected file."))
    reader.readAsDataURL(file)
  })

const requestPassengerEmergencyLocation = () =>
  new Promise<{
    latitude: number
    longitude: number
    accuracy?: number
  }>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Location access is required to send an accurate emergency report, but this device does not support location services."))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : undefined
        })
      },
      () => {
        reject(new Error("Location access is required to send an accurate emergency report. Please allow location permission and try again."))
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    )
  })

const BackIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M15.5 5l-7 7 7 7"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
)

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 16V7m0 0l-3 3m3-3l3 3M6.5 16.5a3.5 3.5 0 010-7 4.5 4.5 0 018.73-1.54A4 4 0 1117.5 20H8"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M7.5 12.5l3 3 6-7"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
)

const TripViewIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4.5 18.25h15m-11.25-4.5 3.25-3.25 2.5 2.5 4-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
    <path
      d="M6 7.75A2.25 2.25 0 1 1 6 3.25a2.25 2.25 0 0 1 0 4.5Zm12 12A2.25 2.25 0 1 1 18 15.25a2.25 2.25 0 0 1 0 4.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    />
  </svg>
)

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M6.75 6.75l10.5 10.5m0-10.5-10.5 10.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
    />
  </svg>
)

const CategoryIcon = ({ tone }: { tone: CategoryTone }) => {
  if (tone === "danger") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3l8 14H4L12 3z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M12 9v3.5m0 2.75h.01"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    )
  }

  if (tone === "info") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 10.25v5m0-7.5h.01"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    )
  }

  if (tone === "warning") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M6 7.5h12M7.5 12h9M9.5 16.5h5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 8h8M8 12h8M8 16h5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

const handleBack = () => {
  if (window.history.length > 1) {
    window.history.back()
    return
  }

  window.location.href = "about:blank"
}

export default function App() {
  const qrToken = useMemo(parseQrToken, [])
  const reportingApi = useMemo(resolveReportingApiBase, [])
  const [effectiveReportingApiBaseUrl, setEffectiveReportingApiBaseUrl] = useState<string | null>(null)
  const apiBaseUrl = effectiveReportingApiBaseUrl ?? reportingApi.apiBaseUrl
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [data, setData] = useState<ReportingPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [reportTypeCode, setReportTypeCode] = useState("")
  const [passengerName, setPassengerName] = useState("")
  const [passengerContact, setPassengerContact] = useState("")
  const [description, setDescription] = useState("")
  const [fareCharged, setFareCharged] = useState("")
  const [evidenceImage, setEvidenceImage] = useState<EvidenceImage | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submission, setSubmission] = useState<SubmissionPayload | null>(null)
  const [emergencyConfirmOpen, setEmergencyConfirmOpen] = useState(false)
  const [emergencyAlert, setEmergencyAlert] = useState<EmergencyAlertRecord | null>(null)
  const [emergencyBusy, setEmergencyBusy] = useState(false)
  const [emergencyLocation, setEmergencyLocation] = useState<{
    latitude: number
    longitude: number
    accuracy?: number
  } | null>(null)
  const [emergencyResponseOpen, setEmergencyResponseOpen] = useState(false)
  const [tripViewOpen, setTripViewOpen] = useState(false)
  const [tripTrackingState, setTripTrackingState] = useState<TripTrackingState>("idle")
  const [tripView, setTripView] = useState<PassengerTripView | null>(null)

  useEffect(() => {
    let active = true

    if (!qrToken) {
      setPageError("This page must be opened from a valid passenger reporting QR code.")
      setLoading(false)
      return () => {
        active = false
      }
    }

    if (reportingApi.error || apiBaseUrl === null) {
      setPageError(
        reportingApi.error ??
          "Passenger reporting is not configured right now. Please try again later."
      )
      setLoading(false)
      return () => {
        active = false
      }
    }

    const load = async () => {
      setLoading(true)

      const attemptLoad = async (apiBaseUrl: string) => {
        const response = await fetchWithTimeout(buildReportingUrl(apiBaseUrl, qrToken), {
          cache: "no-store",
          timeout: 10000
        })
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean
          message?: string
          data?: ReportingPayload
        }

        if (!response.ok || !payload.data) {
          throw new Error(payload.message ?? `Request failed with HTTP ${response.status}.`)
        }

        if (!active) return
        
        // Check if driver status is inactive
        if (payload.data.context?.driverStatus === "inactive") {
          setPageError("This driver is currently inactive and not accepting reports.")
          return
        }
        
        setData(payload.data)
        setReportTypeCode((current) => current || payload.data?.reportTypes[0]?.code || "")
        setPageError(null)
        if (active) {
          setEffectiveReportingApiBaseUrl(apiBaseUrl)
        }
      }

      try {
        await attemptLoad(apiBaseUrl)
      } catch (loadError) {
        if (
          reportingApi.configuredApiBaseUrl &&
          reportingApi.configuredApiBaseUrl !== apiBaseUrl
        ) {
          try {
            await attemptLoad(reportingApi.configuredApiBaseUrl)
            return
          } catch {
            // Fall through to original error.
          }
        }

        if (!active) return
        setPageError(
          loadError instanceof Error ? loadError.message : "Unable to load report page."
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [qrToken, apiBaseUrl, reportingApi.error])

  useEffect(() => {
    let active = true

    if (!qrToken || apiBaseUrl === null || !data) {
      return () => {
        active = false
      }
    }

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetchWithTimeout(buildReportingUrl(apiBaseUrl, qrToken), {
            cache: "no-store",
            timeout: 10000
          })
          const payload = (await response.json().catch(() => ({}))) as {
            ok?: boolean
            message?: string
            data?: ReportingPayload
          }

          if (!response.ok || !payload.data || !active) {
            return
          }

          // Check if driver status is inactive
          if (payload.data.context?.driverStatus === "inactive") {
            setPageError("This driver is currently inactive and not accepting reports.")
            return
          }

          setData(payload.data)
          setReportTypeCode((current) => current || payload.data?.reportTypes[0]?.code || "")
        } catch {
          // Keep the current page state if background refresh fails.
        }
      })()
    }, 10000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [data, qrToken, apiBaseUrl])

  useEffect(() => {
    let active = true

    if (!qrToken || apiBaseUrl === null) {
      return () => {
        active = false
      }
    }

    const storedTrackingKey = window.localStorage.getItem(
      `${EMERGENCY_STORAGE_PREFIX}${qrToken}`
    )
    if (!storedTrackingKey) {
      return () => {
        active = false
      }
    }

    void getPassengerEmergency(apiBaseUrl, storedTrackingKey)
      .then((alert) => {
        if (!active) return
        if (alert.status === "resolved") {
          window.localStorage.removeItem(`${EMERGENCY_STORAGE_PREFIX}${qrToken}`)
          return
        }
        setEmergencyAlert(alert)
      })
      .catch(() => {
        window.localStorage.removeItem(`${EMERGENCY_STORAGE_PREFIX}${qrToken}`)
      })

    return () => {
      active = false
    }
  }, [qrToken, apiBaseUrl])

  useEffect(() => {
    if (!qrToken || !emergencyAlert || apiBaseUrl === null) {
      return
    }

    const closeStream = connectPassengerEmergencyStream(
      apiBaseUrl,
      emergencyAlert.passengerTrackingKey,
      {
        onSnapshot: (alert) => {
          setEmergencyAlert((current) => current ?? alert)
        },
        onEmergency: (alert) => {
          setEmergencyAlert((current) => {
            const shouldOpenResponseModal =
              current &&
              current.status !== "acknowledged" &&
              current.status !== "responding" &&
              (alert.status === "acknowledged" || alert.status === "responding")

            if (shouldOpenResponseModal) {
              setEmergencyResponseOpen(true)
            }

            return alert
          })
        },
        onError: () => {}
      }
    )

    return () => {
      closeStream()
    }
  }, [qrToken, emergencyAlert?.passengerTrackingKey, apiBaseUrl])

  useEffect(() => {
    if (!qrToken) return

    if (!emergencyAlert || emergencyAlert.status === "resolved") {
      window.localStorage.removeItem(`${EMERGENCY_STORAGE_PREFIX}${qrToken}`)
      return
    }

    window.localStorage.setItem(
      `${EMERGENCY_STORAGE_PREFIX}${qrToken}`,
      emergencyAlert.passengerTrackingKey
    )
  }, [emergencyAlert, qrToken])

  useEffect(() => {
    if (!tripViewOpen || !qrToken || apiBaseUrl === null) {
      return
    }

    let active = true
    setTripTrackingState("loading")

    void getPassengerTripView(apiBaseUrl, qrToken)
      .then((view) => {
        if (!active) return
        if (!hasActiveLiveTrip(view.trip)) {
          setTripViewOpen(false)
          setTripView(null)
          setTripTrackingState("idle")
          return
        }
        setTripView(view)
        setTripTrackingState("ready")
      })
      .catch((error) => {
        if (!active) return
        console.error("Unable to load the active trip.", error)
        setTripViewOpen(false)
        setTripView(null)
        setTripTrackingState("error")
      })

    return () => {
      active = false
    }
  }, [qrToken, apiBaseUrl, tripViewOpen])

  useEffect(() => {
    if (!tripViewOpen || !qrToken || apiBaseUrl === null || !tripView?.trip?.tripId) {
      return
    }

    const closeStream = connectPassengerTripStream(
      apiBaseUrl,
      qrToken,
      tripView.trip.tripId,
      {
        onSnapshot: (view) => {
          if (!hasActiveLiveTrip(view.trip)) {
            setTripViewOpen(false)
            setTripView(null)
            setTripTrackingState("idle")
            return
          }
          setTripView(view)
          setTripTrackingState("ready")
        },
        onTrip: (view) => {
          if (!hasActiveLiveTrip(view.trip)) {
            setTripViewOpen(false)
            setTripView(null)
            setTripTrackingState("idle")
            return
          }
          setTripView(view)
          setTripTrackingState("ready")
        },
        onError: () => {}
      }
    )

    return () => {
      closeStream()
    }
  }, [qrToken, apiBaseUrl, tripView?.trip?.tripId, tripViewOpen])

  const parsedFareCharged = parseFareValue(fareCharged)
  const isFareReport = reportTypeCode === "fare_overpricing"
  const hasDescription = description.trim().length > 0
  const hasValidFareCharge = !isFareReport || parsedFareCharged !== null
  const canSubmit =
    Boolean(data) &&
    reportTypeCode.length > 0 &&
    hasDescription &&
    hasValidFareCharge &&
    !submitting
  const submitButtonLabel = (() => {
    if (submitting) return "Submitting..."
    if (!reportTypeCode.length || !hasValidFareCharge || !hasDescription) {
      if (!reportTypeCode.length || (isFareReport && !hasValidFareCharge)) {
        return "Complete required fields"
      }

      if (!hasDescription) {
        return "Describe what happened to submit"
      }
    }

    return "Submit Report"
  })()

  const handleEvidenceChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setEvidenceImage(null)
      return
    }

    if (!ACCEPTED_FILE_TYPES.has(file.type)) {
      setFormError("Only JPG, PNG, WEBP, PDF, MP4, WebM, or MOV files are supported.")
      event.target.value = ""
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setFormError("Evidence must be 50MB or smaller.")
      event.target.value = ""
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      setEvidenceImage({
        dataUrl,
        mimeType: file.type,
        fileName: file.name,
        size: file.size
      })
      setFormError(null)
    } catch (fileError) {
      setFormError(
        fileError instanceof Error ? fileError.message : "Unable to load the selected file."
      )
    }
  }

  const clearEvidence = () => {
    setEvidenceImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const submitReport = async () => {
    if (!qrToken || !canSubmit) return
    setSubmitting(true)
    setFormError(null)

    try {
      const hiddenReportContext = {
        driver_id: context.driverId,
        trip_id: context.tripId ?? null,
        report_type: reportTypeCode,
        description: description.trim(),
        passenger_name: passengerName.trim() || null,
        passenger_contact: passengerContact.trim() || null,
        fare_charged: parsedFareCharged,
        expected_fare: context.fare?.amount ?? null,
        evidence_url: evidenceImage?.fileName ?? null,
        emergency_requested: emergencyIsActive,
        emergency_request_id: emergencyAlert?.emergencyId ?? null,
        driver_location: latestDriverPoint
          ? {
              latitude: latestDriverPoint.latitude,
              longitude: latestDriverPoint.longitude
            }
          : null,
        driver_latitude: context.latestDriverLocation?.latitude ?? null,
        driver_longitude: context.latestDriverLocation?.longitude ?? null,
        location_status: context.latestDriverLocation?.isOnline ? "online" : "offline",
        trip_started_at: context.tripStartedAt ?? null,
        latest_ping_at: context.latestDriverLocation?.updatedAt ?? null,
        recorded_at: context.latestDriverLocation?.recordedAt ?? null,
        driver_speed: context.latestDriverLocation?.speed ?? null,
        route_name: context.routeName ?? null,
        toda: context.todaName,
        plate_number: context.plateNo ?? null,
        created_at: new Date().toISOString()
      }

      const response = await fetch(buildReportingUrl(apiBaseUrl ?? ""), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          qrToken,
          reportTypeCode,
          passengerName: passengerName.trim() || undefined,
          passengerContact: passengerContact.trim() || undefined,
          description: description.trim(),
          fareCharged: parsedFareCharged ?? undefined,
          expectedFare: context.fare?.amount ?? undefined,
          emergencyRequested: emergencyIsActive,
          emergencyRequestId: emergencyAlert?.emergencyId ?? undefined,
          reportContext: hiddenReportContext,
          evidenceImage: evidenceImage
            ? {
                dataUrl: evidenceImage.dataUrl,
                mimeType: evidenceImage.mimeType,
                fileName: evidenceImage.fileName
              }
            : undefined,
          deviceInfo: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            submittedAt: new Date().toISOString(),
            reportContext: hiddenReportContext
          }
        })
      })

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        data?: SubmissionPayload
      }

      if (!response.ok || !payload.data) {
        throw new Error(payload.message ?? `Request failed with HTTP ${response.status}.`)
      }

      setSubmission(payload.data)
      setPassengerName("")
      setPassengerContact("")
      setDescription("")
      setFareCharged("")
      clearEvidence()
    } catch (submitError) {
      setFormError(
        submitError instanceof Error ? submitError.message : "Unable to submit report."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    setFormError(null)
    void submitReport()
  }

  const submitInvalidQrReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!qrToken || apiBaseUrl === null || !description.trim() || submitting) return

    setSubmitting(true)
    setFormError(null)
    try {
      const response = await fetch(buildReportingUrl(apiBaseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          qrToken,
          reportTypeCode: "suspicious_qr",
          passengerName: passengerName.trim() || undefined,
          passengerContact: passengerContact.trim() || undefined,
          description: description.trim(),
          deviceInfo: {
            source: "invalid_qr_report",
            userAgent: navigator.userAgent,
            language: navigator.language,
            submittedAt: new Date().toISOString()
          }
        })
      })

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        data?: SubmissionPayload
      }

      if (!response.ok || !payload.data) {
        throw new Error(payload.message ?? `Request failed with HTTP ${response.status}.`)
      }

      setSubmission(payload.data)
      setPassengerName("")
      setPassengerContact("")
      setDescription("")
    } catch (submitError) {
      setFormError(
        submitError instanceof Error ? submitError.message : "Unable to submit report."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleEmergencyRequest = async () => {
    if (emergencyBusy || !qrToken) return
    setFormError(null)
    setEmergencyBusy(true)
    setEmergencyLocation(null)

    try {
      const location = await requestPassengerEmergencyLocation()
      setEmergencyLocation(location)
      setEmergencyConfirmOpen(true)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Location access is required for urgent assistance."
      )
    } finally {
      setEmergencyBusy(false)
    }
  }

  const submitEmergencyAlert = async () => {
    if (!qrToken || apiBaseUrl === null) return
    if (!emergencyLocation) {
      setFormError("Passenger location is required to send an urgent assistance request.")
      return
    }

    setEmergencyBusy(true)
    setFormError(null)

    try {
      const created = await createPassengerEmergency(
        apiBaseUrl,
        qrToken,
        emergencyLocation
      )
      setEmergencyAlert(created)
      setEmergencyConfirmOpen(false)
      setEmergencyLocation(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to send emergency alert.")
    } finally {
      setEmergencyBusy(false)
    }
  }

  const openTripView = () => {
    if (!activeLiveTripAvailable) return
    setTripViewOpen(true)
  }

  const closeTripView = () => {
    setTripViewOpen(false)
    setTripView(null)
    setTripTrackingState("idle")
  }

  if (loading) {
    return (
      <main className="page">
        <section className="panel panel--centered">
          <p className="kicker">Passenger report</p>
          <h1>Loading report form...</h1>
          <p className="muted">Please wait while we load the scanned driver details.</p>
        </section>
      </main>
    )
  }

  if (pageError || !data) {
    return (
      <main className="page">
        <div className="phone-shell">
          <section className="panel panel--centered">
            <p className="kicker">Passenger report</p>
            <h1>{submission ? "Report Submitted" : pageError ? "Error" : "Unverified Driver"}</h1>
            <p className="muted">
              {submission
                ? "Your suspicious QR report was submitted for admin review."
                : pageError
                  ? pageError
                  : "This QR code is not connected to an official TODA driver record. You may still submit a report so the admin can review this issue."}
            </p>
          </section>

          {!submission && qrToken && apiBaseUrl !== null ? (
            <form className="report-form" onSubmit={submitInvalidQrReport}>
              <section className="panel">
                <p className="kicker">Suspicious QR Report</p>
                <label className="field">
                  <span>What happened?</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={6}
                    placeholder="Describe why this QR looks suspicious or does not match the driver."
                    disabled={submitting}
                  />
                </label>
                <label className="field">
                  <span>Your name (optional)</span>
                  <input
                    value={passengerName}
                    onChange={(event) => setPassengerName(event.target.value)}
                    placeholder="Optional"
                    disabled={submitting}
                  />
                </label>
                <label className="field">
                  <span>Contact details (optional)</span>
                  <input
                    value={passengerContact}
                    onChange={(event) => setPassengerContact(event.target.value)}
                    placeholder="Phone or email"
                    disabled={submitting}
                  />
                </label>
              </section>

              {formError && <div className="notice notice--error">{formError}</div>}

              <div className="sticky-submit-bar">
                <button
                  type="submit"
                  className="primary-button sticky-submit-button"
                  disabled={!description.trim() || submitting}
                >
                  {submitting ? "Submitting..." : "Submit Suspicious QR Report"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </main>
    )
  }

  const { context, reportTypes } = data
  const orderedReportTypes = [...reportTypes].sort(
    (left, right) => getCategoryMeta(left.code).order - getCategoryMeta(right.code).order
  )
  const emergencyIsActive =
    emergencyAlert !== null && emergencyAlert.status !== "resolved"
  const emergencyStatusLabel =
    emergencyAlert?.status === "responding" || emergencyAlert?.status === "acknowledged"
      ? "Admin responding"
      : emergencyAlert?.status === "resolved"
        ? "Resolved"
        : "Waiting for admin"
  const latestDriverPoint = context.latestDriverLocation
    ? {
        latitude: context.latestDriverLocation.latitude,
        longitude: context.latestDriverLocation.longitude,
        accuracy: context.latestDriverLocation.accuracy,
        heading: context.latestDriverLocation.heading
      }
    : null
  const isDriverActive = context.driverStatus.toLowerCase() === "active"
  const isOfficialQr = context.qrIsActive === true && context.qrIssuedByAdmin === true
  const isDriverVerified =
    context.driverIsVerified === true &&
    context.driverCreatedByAdmin === true &&
    isOfficialQr &&
    isDriverActive &&
    Boolean(context.driverCode) &&
    Boolean(context.todaName) &&
    Boolean(context.barangayName) &&
    Boolean(context.plateNo)
  const verificationBadgeLabel = isDriverVerified
    ? "Verified TODA Driver"
    : isOfficialQr
      ? "Driver Not Currently Authorized"
      : "Unverified Driver"
  const driverLocationLabel = [context.todaName, context.barangayName]
    .filter(Boolean)
    .join(" / ")
  const isDriverLocationFresh = isFreshLocation(context.latestDriverLocation?.recordedAt)
  const tripStatusLabel =
    context.tripStatus === "ongoing" ? "Active trip ongoing" : "No active trip"
  const updatedLabel = formatRelativeTime(
    context.latestDriverLocation?.updatedAt ?? context.latestDriverLocation?.recordedAt
  )
  const activeTripAvailable = Boolean(context.tripId && context.tripStatus === "ongoing")
  const activeLiveTripAvailable =
    isDriverVerified &&
    activeTripAvailable &&
    context.latestDriverLocation?.isOnline === true &&
    isDriverLocationFresh
  const statusLine =
    activeLiveTripAvailable && latestDriverPoint !== null
      ? `${tripStatusLabel} • ${updatedLabel}`
      : null
  const tripViewTrip = tripView?.trip
  const tripViewCurrentPoint = tripViewTrip?.location
    ? {
        latitude: tripViewTrip.location.latitude,
        longitude: tripViewTrip.location.longitude,
        accuracy: tripViewTrip.location.accuracy,
        heading: tripViewTrip.location.heading
      }
    : null
  const showTripDetails = tripTrackingState === "ready" && hasActiveLiveTrip(tripViewTrip)
  const tripScreenPoint = showTripDetails ? tripViewCurrentPoint : latestDriverPoint

  return (
    <main className="page">
      <div className="phone-shell">
        <header className="topbar">
          <button type="button" className="icon-button" onClick={handleBack} aria-label="Go back">
            <BackIcon />
          </button>
          <div>
            <h1>{submission ? "Report Submitted" : "Report Details"}</h1>
            <p>Submit a concern for the scanned driver.</p>
          </div>
        </header>

        {submission ? (
          <section className="panel success-panel">
            <div className="success-icon">
              <CheckIcon />
            </div>
            <h2>Report submitted</h2>
            <p className="muted">
              Your report has been recorded under <strong>{context.driverName}</strong>.
            </p>
            <div className="reference-box">
              <span>Reference ID</span>
              <strong>#{submission.reportId}</strong>
            </div>
            <div className="button-stack">
              <button type="button" className="primary-button" onClick={() => setSubmission(null)}>
                Submit another report
              </button>
              <button type="button" className="secondary-button" onClick={handleBack}>
                Back
              </button>
            </div>
          </section>
        ) : (
          <form className="form-stack" onSubmit={handleSubmitRequest}>
            <section className="panel profile-panel profile-panel--compact">
              <p className="kicker">Driver Information</p>
              <div className="driver-identity">
                {context.driverAvatarUrl ? (
                  <img
                    className="driver-avatar"
                    src={context.driverAvatarUrl}
                    alt={context.driverName}
                  />
                ) : (
                  <div className="driver-avatar driver-avatar--fallback" aria-hidden="true">
                    {context.driverName
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() ?? "")
                      .join("")}
                  </div>
                )}
                <div className="driver-summary">
                  <strong>{context.driverName}</strong>
                  <span>{context.driverCode}</span>
                  <span>
                    {context.plateNo ?? "No unit assigned"} • {driverLocationLabel}
                  </span>
                </div>
              </div>
              <div className="driver-verification-line">
                <span
                  className={`driver-verification-badge ${
                    isDriverVerified
                      ? "driver-verification-badge--verified"
                      : "driver-verification-badge--unverified"
                  }`}
                >
                  {verificationBadgeLabel}
                </span>
                {context.verificationStatus ? (
                  <p className="driver-verification-subtext">
                    {context.verificationStatus}
                  </p>
                ) : null}
              </div>
              <div className="driver-status-line">
                <span
                  className={`status-pill ${
                    activeTripAvailable ? "status-pill--active" : "status-pill--neutral"
                  }`}
                >
                  {activeTripAvailable ? "Active" : "Inactive"}
                </span>
                {statusLine ? <p>{statusLine}</p> : null}
              </div>
              {!isDriverVerified && (
                <div className="driver-verification-note">
                  {isOfficialQr
                    ? "This driver exists in the system but is not currently allowed to operate. You may submit a report to notify the admin."
                    : "This QR code is not connected to an active official TODA driver token. You may still submit a report so the admin can review this issue."}
                </div>
              )}
              {activeLiveTripAvailable ? (
                <div className="driver-trip-action">
                  <button
                    type="button"
                    className="trip-view-button"
                    onClick={openTripView}
                  >
                    <TripViewIcon />
                    <span>View Live Trip</span>
                  </button>
                </div>
              ) : null}
            </section>

            <section className="panel fare-info-panel">
              <p className="kicker">Fare Information</p>
              <div className="fare-info-grid">
                <div className="fare-info-item">
                  <span className="fare-info-label">Full tricycle fare:</span>
                  <strong className="fare-info-value">PHP 10.00 per passenger</strong>
                </div>
                <div className="fare-info-item">
                  <span className="fare-info-label">Solo passenger fare:</span>
                  <strong className="fare-info-value">PHP 15.00</strong>
                </div>
              </div>
              <p className="fare-info-note">
                These are the standard fares for tricycle rides. If you believe you were overcharged, select "Fare Overpricing" as the report reason.
              </p>
            </section>

            <section className="panel">
              <p className="kicker">Why are you reporting this?</p>
              <div className="category-list" role="radiogroup" aria-label="Report category">
                {orderedReportTypes.map((type) => {
                  const meta = getCategoryMeta(type.code)
                  const selected = reportTypeCode === type.code

                  return (
                    <button
                      key={type.reportTypeId}
                      type="button"
                      className={`category-card${selected ? " category-card--selected" : ""}`}
                      onClick={() => setReportTypeCode(type.code)}
                      disabled={submitting}
                      role="radio"
                      aria-checked={selected}
                    >
                      <div className={`category-card__icon category-card__icon--${meta.tone}`}>
                        <CategoryIcon tone={meta.tone} />
                      </div>
                      <div className="category-card__content">
                        <strong>{meta.title}</strong>
                        <span>{meta.description}</span>
                      </div>
                      <div className="category-card__check" aria-hidden="true">
                        {selected ? <CheckIcon /> : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            {isFareReport && (
              <section className="panel fare-panel">
                <p className="kicker">Fare Check</p>
                <label className="field">
                  <span>Amount you were charged</span>
                  <input
                    value={fareCharged}
                    onChange={(event) => setFareCharged(event.target.value)}
                    placeholder="PHP 0.00"
                    inputMode="decimal"
                    disabled={submitting}
                  />
                </label>
                <p className="fare-helper">
                  Enter the fare you were asked to pay. Admin will review this with your report.
                </p>
              </section>
            )}

            <section className="panel">
              <p className="kicker">Report Details</p>
              <label className="field">
                <span>What happened?</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={6}
                  placeholder="Describe what happened clearly."
                  disabled={submitting}
                />
              </label>

              <label className="field">
                <span>Your name (optional)</span>
                <input
                  value={passengerName}
                  onChange={(event) => setPassengerName(event.target.value)}
                  placeholder="Optional"
                  disabled={submitting}
                />
              </label>

              <label className="field">
                <span>Contact details (optional)</span>
                <input
                  value={passengerContact}
                  onChange={(event) => setPassengerContact(event.target.value)}
                  placeholder="Phone or email"
                  disabled={submitting}
                />
              </label>

              <div className="field">
                <span>Upload evidence (optional)</span>
                <input
                  ref={fileInputRef}
                  className="hidden-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/quicktime"
                  onChange={handleEvidenceChange}
                />
                <button
                  type="button"
                  className="upload-box"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="upload-box__icon">
                    <UploadIcon />
                  </div>
                  <strong>Upload photo, video, screenshot, or document</strong>
                  <span>JPG, PNG, WEBP, PDF, MP4, WebM, or MOV up to 50MB</span>
                </button>

                {evidenceImage && (
                  <div className="upload-preview">
                    {evidenceImage.mimeType === "application/pdf" ? (
                      <div className="upload-preview__document" aria-hidden="true">
                        PDF
                      </div>
                    ) : evidenceImage.mimeType.startsWith("video/") ? (
                      <video
                        src={evidenceImage.dataUrl}
                        controls
                        style={{ maxWidth: "100%", maxHeight: "200px" }}
                        aria-label="Selected video evidence"
                      />
                    ) : (
                      <img src={evidenceImage.dataUrl} alt="Selected proof" />
                    )}
                    <div className="upload-preview__meta">
                      <strong>{evidenceImage.fileName}</strong>
                      <span>{formatBytes(evidenceImage.size)}</span>
                    </div>
                    <button type="button" className="text-button" onClick={clearEvidence}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section className="panel emergency-panel">
              <p className="kicker">Need urgent help?</p>
              <p className="muted">
                Use this only if the situation needs immediate admin attention.
              </p>
              {emergencyIsActive && emergencyAlert ? (
                <div className="emergency-status-card">
                  <strong>{emergencyStatusLabel}</strong>
                  <span>
                    {emergencyAlert.status === "responding" ||
                    emergencyAlert.status === "acknowledged"
                      ? `Emergency #${emergencyAlert.emergencyId} was sent at ${new Date(
                          emergencyAlert.createdAt
                        ).toLocaleTimeString()}.`
                      : "Admin has been notified."}
                  </span>
                  {emergencyAlert.status !== "responding" &&
                  emergencyAlert.status !== "acknowledged" ? (
                    <span>Sent at {new Date(emergencyAlert.createdAt).toLocaleTimeString()}.</span>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  className="danger-button danger-button--outline"
                  onClick={handleEmergencyRequest}
                  disabled={emergencyBusy || emergencyIsActive}
                >
                  {emergencyBusy && !emergencyConfirmOpen ? "Requesting location..." : emergencyBusy ? "Sending emergency..." : "Request Admin Assistance"}
                </button>
              )}
            </section>

            {formError && <div className="notice notice--error">{formError}</div>}

            <div className="sticky-submit-bar">
              <button type="submit" className="primary-button sticky-submit-button" disabled={!canSubmit}>
                {submitButtonLabel}
              </button>
            </div>
          </form>
        )}
      </div>

      {tripViewOpen && (
        <section
          className="trip-screen"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trip-view-title"
        >
          <div className="trip-screen__map">
            <TriketrackMap
              currentLocation={tripScreenPoint}
              breadcrumbPoints={[]}
              routeCoordinates={[]}
              mapStyle="street"
              showControls
              showStyleSwitcher={false}
              showLocateButton={false}
              viewportPadding={{ top: 180, right: 32, bottom: 176, left: 32 }}
              className="triketrack-map--fullscreen"
            />
          </div>
          <button
            type="button"
            className="trip-screen__close"
            onClick={closeTripView}
            aria-label="Close live trip view"
          >
            <CloseIcon />
          </button>

          {showTripDetails && tripView && tripViewTrip && (
            <div className="trip-screen__bottom">
              <section className="trip-screen__driver-card">
                <div className="trip-screen__driver-identity">
                  {context.driverAvatarUrl ? (
                    <img
                      className="driver-avatar"
                      src={context.driverAvatarUrl}
                      alt={tripView.driverName}
                    />
                  ) : (
                    <div className="driver-avatar driver-avatar--fallback" aria-hidden="true">
                      {tripView.driverName
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase() ?? "")
                        .join("")}
                    </div>
                  )}
                  <div className="trip-screen__driver-copy">
                    <strong>{tripView.driverName}</strong>
                    <span>{tripView.driverCode}</span>
                    <span>{tripViewTrip.plateOrBodyNumber} • {driverLocationLabel}</span>
                  </div>
                </div>

                <div className="trip-screen__trip-stats">
                  <div>
                    <span className="trip-screen__stat-label">Status</span>
                    <strong>Active Trip</strong>
                  </div>
                  <div>
                    <span className="trip-screen__stat-label">Fare</span>
                    <strong>{typeof tripViewTrip.fareAmount === "number"
                      ? formatCurrency(tripViewTrip.fareAmount, context.fare?.currency ?? "PHP")
                      : "Not available"}</strong>
                  </div>
                  <div>
                    <span className="trip-screen__stat-label">Distance</span>
                    <strong>{formatDistance(tripViewTrip.distanceKilometers)}</strong>
                  </div>
                  <div>
                    <span className="trip-screen__stat-label">Speed</span>
                    <strong>{formatSpeed(tripViewTrip.speedKph)}</strong>
                  </div>
                </div>
              </section>
            </div>
          )}
        </section>
      )}

      {emergencyConfirmOpen && !submission && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => !emergencyBusy && setEmergencyConfirmOpen(false)}
        >
          <section
            className="confirm-modal confirm-modal--emergency"
            role="dialog"
            aria-modal="true"
            aria-labelledby="emergency-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-modal__icon confirm-modal__icon--danger">
              <CategoryIcon tone="danger" />
            </div>
            <h2 id="emergency-confirm-title">Send emergency alert?</h2>
            <p className="muted">
              This will immediately notify the admin dashboard that a passenger needs urgent attention for{" "}
              <strong>{context.driverName}</strong>. Your current location will be included with the request.
            </p>

            <div className="confirm-summary">
              <strong>Before you proceed:</strong>
              <ul>
                <li>Use this only for urgent situations that need immediate action.</li>
                <li>Your current GPS location has already been requested and will be sent with the alert.</li>
                <li>The admin dashboard will receive the emergency in real time.</li>
                <li>You will be notified here once the admin confirms they are responding.</li>
              </ul>
            </div>

            <div className="button-stack">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  if (!emergencyBusy) {
                    setEmergencyConfirmOpen(false)
                    setEmergencyLocation(null)
                  }
                }}
                disabled={emergencyBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => void submitEmergencyAlert()}
                disabled={emergencyBusy}
              >
                {emergencyBusy ? "Sending..." : "Proceed"}
              </button>
            </div>
          </section>
        </div>
      )}

      {emergencyResponseOpen && emergencyAlert && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setEmergencyResponseOpen(false)}
        >
          <section
            className="confirm-modal confirm-modal--status"
            role="dialog"
            aria-modal="true"
            aria-labelledby="emergency-response-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="success-icon">
              <CheckIcon />
            </div>
            <h2 id="emergency-response-title">Admin is taking action</h2>
            <p className="muted">
              Your emergency request has been received. The admin is now reviewing your location and driver details.
            </p>
            <p className="muted">
              Please stay safe and wait for further assistance.
            </p>
            <div className="reference-box">
              <span>Status</span>
              <strong>{emergencyStatusLabel}</strong>
            </div>
            <div className="button-stack">
              <button
                type="button"
                className="primary-button"
                onClick={() => setEmergencyResponseOpen(false)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

type TripRecord = {
  id: string
  driverId: string
  startedAt: string // ISO
  endedAt: string | null // ISO or null for active trips
}

type ReportLinkStatus =
  | "linked-to-active-trip"
  | "linked-to-nearest-trip"
  | "needs-admin-review"
  | "no-matching-trip"

type ReportMatchResult = {
  status: ReportLinkStatus
  linkedTripId: string | null
  reason: string
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000

const parseDate = (value: string | null): Date | null =>
  value ? new Date(value) : null

const isSameDay = (dateA: Date, dateB: Date) =>
  dateA.getFullYear() === dateB.getFullYear() &&
  dateA.getMonth() === dateB.getMonth() &&
  dateA.getDate() === dateB.getDate()

const getTripRange = (trip: TripRecord) => {
  const start = parseDate(trip.startedAt)
  const end = parseDate(trip.endedAt)
  return { start, end }
}

const getTimeDiff = (base: Date, value: Date | null): number =>
  value ? Math.abs(base.getTime() - value.getTime()) : Number.POSITIVE_INFINITY

export const matchReportToTrip = (
  reportTimeIso: string,
  driverTripsToday: TripRecord[],
  activeTrip: TripRecord | null
): ReportMatchResult => {
  const reportTime = new Date(reportTimeIso)

  if (activeTrip) {
    return {
      status: "linked-to-active-trip",
      linkedTripId: activeTrip.id,
      reason: "Active trip exists at report time."
    }
  }

  const sameDayTrips = driverTripsToday.filter((trip) => {
    const tripStart = parseDate(trip.startedAt)
    return tripStart && isSameDay(tripStart, reportTime)
  })

  if (!sameDayTrips.length) {
    return {
      status: "no-matching-trip",
      linkedTripId: null,
      reason: "No same-day trips found for the driver."
    }
  }

  const tripInsideReportTime = sameDayTrips.find((trip) => {
    const { start, end } = getTripRange(trip)
    if (!start) return false
    if (!end) return false
    return reportTime >= start && reportTime <= end
  })

  if (tripInsideReportTime) {
    return {
      status: "linked-to-nearest-trip",
      linkedTripId: tripInsideReportTime.id,
      reason: "Report time falls inside this trip."
    }
  }

  const nearest = sameDayTrips.reduce<{
    trip: TripRecord | null
    diffMs: number
  }>(
    (best, trip) => {
      const start = parseDate(trip.startedAt)
      const end = parseDate(trip.endedAt)

      if (!start && !end) return best

      const diffStart = getTimeDiff(reportTime, start)
      const diffEnd = getTimeDiff(reportTime, end)
      const closestDiff = Math.min(diffStart, diffEnd)

      if (!best.trip || closestDiff < best.diffMs) {
        return { trip, diffMs: closestDiff }
      }
      return best
    },
    { trip: null, diffMs: Infinity }
  )

  if (!nearest.trip) {
    return {
      status: "no-matching-trip",
      linkedTripId: null,
      reason: "Unable to determine nearest trip."
    }
  }

  if (nearest.diffMs <= TWO_HOURS_MS) {
    return {
      status: "linked-to-nearest-trip",
      linkedTripId: nearest.trip.id,
      reason: "Nearest same-day trip is within the 2-hour matching window."
    }
  }

  return {
    status: "needs-admin-review",
    linkedTripId: null,
    reason: "Nearest trip is too far from report time and needs manual review."
  }
}

