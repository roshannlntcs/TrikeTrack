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
  driverId: number
  driverCode: string
  driverName: string
  driverAvatarUrl?: string
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
type FareCheckState = "ok" | "warning" | "neutral"
type TripTrackingState = "idle" | "loading" | "ready" | "error"

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])
const PRIVATE_IPV4_PATTERN =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/
const ACCEPTED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
])
const MAX_FILE_SIZE = 5 * 1024 * 1024
const EMERGENCY_STORAGE_PREFIX = "triketrack_passenger_emergency_"

const parseQrToken = () => {
  const parts = window.location.pathname.split("/").filter(Boolean)
  return parts[0] === "report" && parts[1] ? decodeURIComponent(parts[1]) : null
}

const parseApiBaseOverride = () => {
  const value = new URLSearchParams(window.location.search).get("apiBase")
  return isNonEmptyString(value) ? value.trim() : null
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

const normalizePublicBaseUrl = (value: string) => {
  try {
    const url = new URL(value.trim())
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
  if (queryOverride) {
    const normalized = normalizePublicBaseUrl(queryOverride)
    if (normalized) {
      return { apiBaseUrl: normalized, error: null }
    }
  }

  const configuredValue = [
    import.meta.env.VITE_PUBLIC_BACKEND_BASE_URL,
    import.meta.env.VITE_PUBLIC_API_BASE_URL,
    import.meta.env.VITE_PASSENGER_REPORT_API_BASE_URL,
    import.meta.env.VITE_BACKEND_BASE_URL
  ].find(isNonEmptyString)

  if (configuredValue) {
    const normalized = normalizePublicBaseUrl(configuredValue)
    if (normalized) {
      return { apiBaseUrl: normalized, error: null }
    }

    return {
      apiBaseUrl: null,
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

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
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

const parseFareValue = (value: string) => {
  const normalized = value.replace(/[^0-9.]/g, "")
  if (!normalized) return null

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return parsed
}

const getFareCheckResult = (
  fare: PassengerReportContext["fare"],
  chargedFare: string
): {
  state: FareCheckState
  title: string
  detail: string
} => {
  const enteredFare = parseFareValue(chargedFare)
  if (enteredFare === null) {
    return {
      state: "neutral",
      title: "Enter the fare you were asked to pay",
      detail: "We will compare it against the encoded trip fare when available."
    }
  }

  if (!fare?.amount || fare.source === "unavailable") {
    return {
      state: "neutral",
      title: "No encoded fare available yet",
      detail: "This route has no backend fare reference yet, so the amount cannot be validated automatically."
    }
  }

  const difference = Number((enteredFare - fare.amount).toFixed(2))
  const referenceLabel = fare.source === "route" ? "route default fare" : "encoded trip fare"
  if (difference <= 0) {
    return {
      state: "ok",
      title: "Fare looks within the backend fare reference",
      detail: `Entered fare ${formatCurrency(enteredFare, fare.currency)} versus ${referenceLabel} ${formatCurrency(fare.amount, fare.currency)}.`
    }
  }

  return {
    state: "warning",
    title: "Possible fare overpricing",
    detail: `Entered fare ${formatCurrency(enteredFare, fare.currency)} is ${formatCurrency(difference, fare.currency)} above the ${referenceLabel}.`
  }
}

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
  const [emergencyResponseOpen, setEmergencyResponseOpen] = useState(false)
  const [tripViewOpen, setTripViewOpen] = useState(false)
  const [tripTrackingState, setTripTrackingState] = useState<TripTrackingState>("idle")
  const [tripTrackingError, setTripTrackingError] = useState<string | null>(null)
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

    if (reportingApi.error || reportingApi.apiBaseUrl === null) {
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
      try {
        const response = await fetch(buildReportingUrl(reportingApi.apiBaseUrl, qrToken), {
          cache: "no-store"
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
        setData(payload.data)
        setReportTypeCode((current) => current || payload.data?.reportTypes[0]?.code || "")
        setPageError(null)
      } catch (loadError) {
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
  }, [qrToken, reportingApi.apiBaseUrl, reportingApi.error])

  useEffect(() => {
    let active = true

    if (!qrToken || reportingApi.apiBaseUrl === null || !data) {
      return () => {
        active = false
      }
    }

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(buildReportingUrl(reportingApi.apiBaseUrl, qrToken), {
            cache: "no-store"
          })
          const payload = (await response.json().catch(() => ({}))) as {
            ok?: boolean
            message?: string
            data?: ReportingPayload
          }

          if (!response.ok || !payload.data || !active) {
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
  }, [data, qrToken, reportingApi.apiBaseUrl])

  useEffect(() => {
    let active = true

    if (!qrToken || reportingApi.apiBaseUrl === null) {
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

    void getPassengerEmergency(reportingApi.apiBaseUrl, storedTrackingKey)
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
  }, [qrToken, reportingApi.apiBaseUrl])

  useEffect(() => {
    if (!qrToken || !emergencyAlert || reportingApi.apiBaseUrl === null) {
      return
    }

    const closeStream = connectPassengerEmergencyStream(
      reportingApi.apiBaseUrl,
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
  }, [qrToken, emergencyAlert?.passengerTrackingKey, reportingApi.apiBaseUrl])

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
    if (!tripViewOpen || !qrToken || reportingApi.apiBaseUrl === null) {
      return
    }

    let active = true
    setTripTrackingState("loading")
    setTripTrackingError(null)

    void getPassengerTripView(reportingApi.apiBaseUrl, qrToken)
      .then((view) => {
        if (!active) return
        setTripView(view)
        setTripTrackingState("ready")
      })
      .catch((error) => {
        if (!active) return
        setTripTrackingError(
          error instanceof Error ? error.message : "Unable to load the active trip."
        )
        setTripTrackingState("error")
      })

    return () => {
      active = false
    }
  }, [qrToken, reportingApi.apiBaseUrl, tripViewOpen])

  useEffect(() => {
    if (!tripViewOpen || !qrToken || reportingApi.apiBaseUrl === null || !tripView?.trip?.tripId) {
      return
    }

    const closeStream = connectPassengerTripStream(
      reportingApi.apiBaseUrl,
      qrToken,
      tripView.trip.tripId,
      {
        onSnapshot: (view) => {
          setTripView(view)
          setTripTrackingState("ready")
          setTripTrackingError(null)
        },
        onTrip: (view) => {
          setTripView(view)
          setTripTrackingState("ready")
          setTripTrackingError(null)
        },
        onError: () => {
          setTripTrackingError("Live trip updates are reconnecting.")
        }
      }
    )

    return () => {
      closeStream()
    }
  }, [qrToken, reportingApi.apiBaseUrl, tripView?.trip?.tripId, tripViewOpen])

  const parsedFareCharged = parseFareValue(fareCharged)
  const isFareReport = reportTypeCode === "fare_overpricing"
  const hasDescription = description.trim().length > 0
  const hasValidFareCharge = !isFareReport || parsedFareCharged !== null
  const canSubmit =
    Boolean(data?.context.reportingAvailable) &&
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
      setFormError("Only JPG, PNG, WEBP, or PDF files are supported.")
      event.target.value = ""
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setFormError("Evidence must be 5MB or smaller.")
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

      const response = await fetch(buildReportingUrl(reportingApi.apiBaseUrl ?? ""), {
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

  const handleEmergencyRequest = () => {
    if (emergencyBusy || !qrToken) return
    setFormError(null)
    setEmergencyConfirmOpen(true)
  }

  const submitEmergencyAlert = async () => {
    if (!qrToken || reportingApi.apiBaseUrl === null) return
    setEmergencyBusy(true)
    setFormError(null)

    try {
      const location = await requestPassengerEmergencyLocation()
      const created = await createPassengerEmergency(reportingApi.apiBaseUrl, qrToken, location)
      setEmergencyAlert(created)
      setEmergencyConfirmOpen(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to send emergency alert.")
    } finally {
      setEmergencyBusy(false)
    }
  }

  const openTripView = () => {
    setTripViewOpen(true)
    setTripTrackingError(null)
  }

  const closeTripView = () => {
    setTripViewOpen(false)
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
        <section className="panel panel--centered">
          <p className="kicker">Passenger report</p>
          <h1>Unable to open this QR code</h1>
          <p className="muted">
            {pageError ?? "This passenger reporting link is no longer available."}
          </p>
        </section>
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
  const fareCheckResult = getFareCheckResult(context.fare, fareCharged)
  const isDriverLocationFresh =
    context.latestDriverLocation?.recordedAt !== undefined &&
    Date.now() - new Date(context.latestDriverLocation.recordedAt).getTime() <= 5 * 60 * 1000
  const tripStatusLabel =
    context.tripStatus === "ongoing" ? "Active trip ongoing" : "No active trip"
  const driverPresenceLabel =
    latestDriverPoint && isDriverLocationFresh
      ? context.latestDriverLocation?.isOnline
        ? "Driver online"
        : "Driver offline"
      : "Driver offline"
  const updatedLabel = formatRelativeTime(
    context.latestDriverLocation?.updatedAt ?? context.latestDriverLocation?.recordedAt
  )
  const statusLine = `${tripStatusLabel} â€¢ ${driverPresenceLabel} â€¢ ${updatedLabel}`
  const activeTripAvailable = Boolean(context.tripId && context.tripStatus === "ongoing")
  const tripViewTrip = tripView?.trip
  const tripViewCurrentPoint = tripViewTrip?.location
    ? {
        latitude: tripViewTrip.location.latitude,
        longitude: tripViewTrip.location.longitude,
        accuracy: tripViewTrip.location.accuracy,
        heading: tripViewTrip.location.heading
      }
    : null
  const tripViewHasLocation = Boolean(tripViewTrip?.location)
  const tripViewIsOnline =
    tripViewTrip?.location?.isOnline === true && tripViewTrip?.trackingStatus === "live"
  const tripViewStatusTitle = !tripViewTrip
    ? "No active trip available"
    : !tripViewHasLocation
      ? "Location unavailable"
      : tripViewIsOnline
        ? "Driver online"
        : tripViewTrip.trackingStatus === "last_known"
          ? "Driver offline"
          : "Location not updated recently"
  const tripViewStatusSubtitle = !tripViewTrip
    ? "Live location is unavailable right now"
    : !tripViewHasLocation
      ? "Waiting for a driver location update"
      : tripViewIsOnline
        ? "Live location updating"
        : tripViewTrip.trackingStatus === "last_known"
          ? "Showing last known location"
          : "Location not updated recently"
  const tripDriverTripLine = !tripViewTrip
    ? "No active trip available"
    : tripViewTrip.tripStatus === "ongoing"
      ? "Active trip"
      : "Trip available"

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
                  <span>
                    {context.plateNo ?? "No unit assigned"} â€¢ {context.todaName}
                  </span>
                </div>
              </div>
              <div className="driver-status-line">
                <span
                  className={`status-pill ${
                    activeTripAvailable || driverPresenceLabel === "Driver online"
                      ? "status-pill--active"
                      : "status-pill--neutral"
                  }`}
                >
                  {activeTripAvailable ? "Active" : "Inactive"}
                </span>
                <p>{statusLine}</p>
              </div>
              <div className="driver-trip-action">
                <button
                  type="button"
                  className="trip-view-button"
                  onClick={openTripView}
                  disabled={!activeTripAvailable}
                  aria-disabled={!activeTripAvailable}
                >
                  <TripViewIcon />
                  <span>{activeTripAvailable ? "View Live Trip" : "No active trip right now"}</span>
                </button>
              </div>
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
                    placeholder="â‚±0.00"
                    inputMode="decimal"
                    disabled={submitting}
                  />
                </label>
                <div className="fare-result">
                  <span>Expected fare</span>
                  <strong>
                    {typeof context.fare?.amount === "number"
                      ? formatCurrency(context.fare.amount, context.fare.currency)
                      : "Expected fare is not available yet. We will compare this with the trip fare record once available."}
                  </strong>
                </div>
                <div className={`fare-result fare-result--${fareCheckResult.state}`}>
                  <strong>{fareCheckResult.title}</strong>
                  <span>{fareCheckResult.detail}</span>
                </div>
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
                  accept="image/jpeg,image/png,image/webp,application/pdf"
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
                  <strong>Upload photo, screenshot, or document</strong>
                  <span>JPG, PNG, WEBP, or PDF up to 5MB</span>
                </button>

                {evidenceImage && (
                  <div className="upload-preview">
                    {evidenceImage.mimeType === "application/pdf" ? (
                      <div className="upload-preview__document" aria-hidden="true">
                        PDF
                      </div>
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

            {!context.reportingAvailable && (
              <div className="notice notice--warn">
                {context.availabilityMessage ?? "This driver is not currently available for reporting."}
              </div>
            )}

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
                  {emergencyBusy ? "Sending emergency..." : "Request Admin Assistance"}
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
              currentLocation={tripViewCurrentPoint}
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
          <div className="trip-screen__top">
            <section className="trip-screen__driver-card">
              <p className="kicker">Live Trip</p>
              <h2 id="trip-view-title">{tripViewStatusTitle}</h2>
              <p className="muted trip-screen__subtitle">{tripViewStatusSubtitle}</p>

              {tripTrackingState === "loading" && (
                <div className="trip-screen__inline-state">
                  <strong>Loading active trip...</strong>
                  <span>Fetching the driver's live trip data.</span>
                </div>
              )}

              {tripTrackingState === "error" && (
                <div className="trip-screen__inline-state trip-screen__inline-state--error">
                  <strong>Unable to load the trip view</strong>
                  <span>{tripTrackingError ?? "Please try again in a moment."}</span>
                </div>
              )}

              {tripTrackingState === "ready" && !tripViewTrip && (
                <div className="trip-screen__inline-state">
                  <strong>No active trip available</strong>
                  <span>The driver does not have an ongoing trip at the moment.</span>
                </div>
              )}

              {tripTrackingState === "ready" && tripViewTrip && (
                <div className="trip-screen__driver-row">
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
                    <span className="trip-screen__meta">
                      <span>Plate {tripViewTrip.plateOrBodyNumber}</span>
                      <span className="trip-screen__meta-separator" aria-hidden="true">
                        &bull;
                      </span>
                      <span>{context.todaName}</span>
                    </span>
                    <span>{tripDriverTripLine}</span>
                  </div>
                  <span
                    className={`status-pill ${
                      tripViewIsOnline ? "status-pill--active" : "status-pill--neutral"
                    }`}
                  >
                    {tripViewIsOnline ? "Online" : "Offline"}
                  </span>
                </div>
              )}
            </section>
          </div>

          <div className="trip-screen__bottom">
            <button
              type="button"
              className="primary-button trip-screen__action"
              onClick={() => {
                closeTripView()
                window.scrollTo({ top: document.body.scrollHeight * 0.45, behavior: "smooth" })
              }}
            >
              Report Driver
            </button>

            {emergencyIsActive && emergencyAlert ? (
              <div className="emergency-status-card emergency-status-card--inline">
                <strong>
                  {emergencyAlert.status === "responding" ||
                  emergencyAlert.status === "acknowledged"
                    ? "Admin responding"
                    : "Emergency request sent"}
                </strong>
                <span>
                  {emergencyAlert.status === "responding" ||
                  emergencyAlert.status === "acknowledged"
                    ? `Emergency #${emergencyAlert.emergencyId} was sent at ${new Date(
                        emergencyAlert.createdAt
                      ).toLocaleTimeString()}.`
                    : "Admin has been notified."}
                </span>
              </div>
            ) : (
              <button
                type="button"
                className="secondary-button trip-screen__action trip-screen__action--secondary"
                onClick={handleEmergencyRequest}
                disabled={emergencyBusy || emergencyIsActive}
              >
                {emergencyBusy ? "Sending emergency..." : "Request Admin Assistance"}
              </button>
            )}
          </div>
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
              <strong>{context.driverName}</strong>.
            </p>

            <div className="confirm-summary">
              <strong>Before you proceed:</strong>
              <ul>
                <li>Use this only for urgent situations that need immediate action.</li>
                <li>The admin dashboard will receive the emergency in real time.</li>
                <li>You will be notified here once the admin confirms they are responding.</li>
              </ul>
            </div>

            <div className="button-stack">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEmergencyConfirmOpen(false)}
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
              Your emergency alert has been received. The admin has already confirmed that they are responding.
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

