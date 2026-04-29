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
} from "../../../common/maps"

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
const ACCEPTED_FILE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_FILE_SIZE = 5 * 1024 * 1024
const EMERGENCY_STORAGE_PREFIX = "triketrack_passenger_emergency_"

const parseQrToken = () => {
  const parts = window.location.pathname.split("/").filter(Boolean)
  return parts[0] === "report" && parts[1] ? decodeURIComponent(parts[1]) : null
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

const formatCoordinateLabel = (location: TriketrackMapCoordinate | null) => {
  if (!location) return "Waiting for GPS location"

  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
}

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

const formatSpeedLabel = (speed?: number) => {
  if (typeof speed !== "number" || !Number.isFinite(speed) || speed < 0) {
    return "Not available"
  }

  return `${speed.toFixed(1)} km/h`
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
): { description: string; tone: CategoryTone } => {
  switch (code) {
    case "harassment":
      return {
        description: "Harassment, threats, or abusive behavior.",
        tone: "danger"
      }
    case "reckless_driving":
      return {
        description: "Unsafe driving, speeding, or dangerous maneuvers.",
        tone: "info"
      }
    case "fare_overpricing":
      return {
        description: "Unfair fare amount or overcharging concern.",
        tone: "warning"
      }
    default:
      return {
        description: "Other conduct or safety concern not listed above.",
        tone: "neutral"
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

      reject(new Error("Unable to read the selected image."))
    }
    reader.onerror = () => reject(new Error("Unable to read the selected image."))
    reader.readAsDataURL(file)
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
  const [confirmOpen, setConfirmOpen] = useState(false)
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

  const canSubmit =
    Boolean(data?.context.reportingAvailable) &&
    reportTypeCode.length > 0 &&
    description.trim().length >= 12 &&
    !submitting

  const handleEvidenceChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setEvidenceImage(null)
      return
    }

    if (!ACCEPTED_FILE_TYPES.has(file.type)) {
      setFormError("Only JPG, PNG, or WEBP photos are supported.")
      event.target.value = ""
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setFormError("Photo proof must be 5MB or smaller.")
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
        fileError instanceof Error ? fileError.message : "Unable to load the selected photo."
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
      setFareCharged("")
      clearEvidence()
      setConfirmOpen(false)
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
    setConfirmOpen(true)
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
      const created = await createPassengerEmergency(reportingApi.apiBaseUrl, qrToken)
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
  const selectedCategory = reportTypes.find((type) => type.code === reportTypeCode)
  const fareReportType = reportTypes.find((type) => type.code === "fare_overpricing")
  const emergencyIsActive =
    emergencyAlert !== null && emergencyAlert.status !== "resolved"
  const emergencyMapPoint =
    typeof emergencyAlert?.latitude === "number" && typeof emergencyAlert?.longitude === "number"
      ? {
          latitude: emergencyAlert.latitude,
          longitude: emergencyAlert.longitude
        }
      : null
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
  const tripStatusLabel = formatTripStatus(context.tripStatus)
  const routeLabel = context.routeName ?? "No route assigned yet"
  const fareReferenceLabel =
    context.fare?.source !== "unavailable" && context.fare?.amount
      ? formatCurrency(context.fare.amount, context.fare.currency)
      : context.fare?.label ?? "No fare reference yet"
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
  const tripViewBreadcrumbs = tripViewTrip?.breadcrumbs.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude
  })) ?? []
  const tripViewStatusLabel =
    tripViewTrip?.tripStatus === "completed"
      ? "Trip has ended"
      : tripViewTrip?.trackingStatus === "live"
        ? "Live tracking active"
        : tripViewTrip?.trackingStatus === "last_known"
          ? "Driver offline, showing last known location"
          : "Waiting for live updates"

  const prefillFareReport = () => {
    if (!fareReportType) return

    const charged = parseFareValue(fareCharged)
    const expected = context.fare?.amount
    const summaryLines = [
      `Passenger fare concern for ${context.driverName}.`,
      context.routeName ? `Route: ${context.routeName}.` : null,
      typeof expected === "number"
        ? `${context.fare?.source === "route" ? "Route default fare" : "Encoded trip fare"}: ${formatCurrency(expected, context.fare?.currency ?? "PHP")}.`
        : "Backend fare reference is not available yet.",
      charged !== null
        ? `Passenger-entered fare: ${formatCurrency(charged, context.fare?.currency ?? "PHP")}.`
        : null
    ]
      .filter(Boolean)
      .join(" ")

    setReportTypeCode(fareReportType.code)
    setDescription((current) => current.trim() || summaryLines)
    setFormError(null)
    window.scrollTo({ top: document.body.scrollHeight * 0.35, behavior: "smooth" })
  }

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
            <section className="panel profile-panel">
              <p className="kicker">Driver details</p>
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
                </div>
              </div>
              <div className="driver-grid">
                <div>
                  <span>Plate / Unit</span>
                  <strong>{context.plateNo ?? "No tricycle assigned"}</strong>
                </div>
                <div>
                  <span>TODA</span>
                  <strong>{context.todaName}</strong>
                </div>
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
                  <span>{activeTripAvailable ? "View Active Trip" : "No active trip right now"}</span>
                </button>
              </div>
            </section>

            <section className="panel trip-status-panel">
              <div className="trip-status-panel__header">
                <div>
                  <p className="kicker">Current trip</p>
                  <h2>{tripStatusLabel}</h2>
                </div>
                <span
                  className={`status-pill${
                    context.tripStatus === "ongoing"
                      ? " status-pill--active"
                      : context.tripStatus === "completed"
                        ? " status-pill--neutral"
                        : ""
                  }`}
                >
                  {context.tripStatus === "ongoing"
                    ? "Live"
                    : context.tripStatus === "completed"
                      ? "Recent"
                      : "Idle"}
                </span>
              </div>
              <div className="driver-grid">
                <div>
                  <span>Route</span>
                  <strong>{routeLabel}</strong>
                </div>
                <div>
                  <span>Trip started</span>
                  <strong>{formatTimestamp(context.tripStartedAt)}</strong>
                </div>
                <div>
                  <span>Latest driver ping</span>
                  <strong>{formatRelativeTime(context.latestDriverLocation?.recordedAt)}</strong>
                </div>
                <div>
                  <span>Driver speed</span>
                  <strong>{formatSpeedLabel(context.latestDriverLocation?.speed)}</strong>
                </div>
              </div>
            </section>

            <section className="panel panel--map">
              <p className="kicker">Trip tracking</p>
              <p className="muted">
                Open the active trip view to see the live marker, trip status, timer, and route updates without exposing noisy raw GPS lines on this page.
              </p>
              <div className="trip-map-meta">
                <div>
                  <span>Driver location</span>
                  <strong>
                    {latestDriverPoint
                      ? formatCoordinateLabel(latestDriverPoint)
                      : "Waiting for driver telemetry"}
                  </strong>
                </div>
                <div>
                  <span>Location status</span>
                  <strong>
                    {latestDriverPoint
                      ? isDriverLocationFresh
                        ? context.latestDriverLocation?.isOnline
                          ? "Driver online"
                          : "Driver recently offline"
                        : "Last known location only"
                      : "Waiting for driver telemetry"}
                  </strong>
                </div>
                <div>
                  <span>Recorded at</span>
                  <strong>{formatTimestamp(context.latestDriverLocation?.recordedAt)}</strong>
                </div>
                <div>
                  <span>Emergency marker</span>
                  <strong>
                    {emergencyMapPoint
                      ? emergencyAlert?.locationLabel ?? "Emergency location"
                      : "No emergency marker"}
                  </strong>
                </div>
              </div>
            </section>

            <section className="panel fare-panel">
              <p className="kicker">Basic fare check</p>
              <p className="muted">
                Compare the fare you were asked to pay against the trip fare stored in the backend.
              </p>
              <div className="fare-panel__summary">
                <div>
                  <span>Fare reference</span>
                  <strong>{fareReferenceLabel}</strong>
                </div>
                <div>
                  <span>Source</span>
                  <strong>
                    {context.fare?.source === "trip"
                      ? "Trip record"
                      : context.fare?.source === "route"
                        ? "Route default"
                        : "No encoded fare yet"}
                  </strong>
                </div>
              </div>
              <label className="field">
                <span>Fare you were charged</span>
                <input
                  value={fareCharged}
                  onChange={(event) => setFareCharged(event.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                  disabled={submitting}
                />
              </label>
              <div className={`fare-result fare-result--${fareCheckResult.state}`}>
                <strong>{fareCheckResult.title}</strong>
                <span>{fareCheckResult.detail}</span>
              </div>
              <div className="fare-panel__actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={prefillFareReport}
                  disabled={submitting || !fareReportType}
                >
                  Use this in a fare report
                </button>
              </div>
            </section>

            <section className="panel">
              <p className="kicker">Why would you like to report?</p>
              <p className="muted">Please select the most appropriate category.</p>
              <div className="category-list" role="radiogroup" aria-label="Report category">
                {reportTypes.map((type) => {
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
                        <strong>{type.label}</strong>
                        <span>{meta.description}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="panel">
              <p className="kicker">Additional information</p>
              <label className="field">
                <span>What happened?</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={7}
                  placeholder="Please provide specific details about what you observed."
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
                  accept="image/jpeg,image/png,image/webp"
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
                  <strong>Click to upload screenshots or documents</strong>
                  <span>Supports JPG, PNG, WEBP up to 5MB</span>
                </button>

                {evidenceImage && (
                  <div className="upload-preview">
                    <img src={evidenceImage.dataUrl} alt="Selected proof" />
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
              <p className="kicker">Need immediate admin attention?</p>
              <p className="muted">
                Use the emergency action only for urgent safety situations that need an immediate admin response.
              </p>
              {emergencyIsActive && emergencyAlert ? (
                <div className="emergency-status-card">
                  <strong>{emergencyStatusLabel}</strong>
                  <span>
                    Emergency #{emergencyAlert.emergencyId} was sent at{" "}
                    {new Date(emergencyAlert.createdAt).toLocaleTimeString()}.
                  </span>
                </div>
              ) : null}
              <button
                type="button"
                className="danger-button"
                onClick={handleEmergencyRequest}
                disabled={emergencyBusy || emergencyIsActive}
              >
                {emergencyBusy ? "Sending emergency..." : emergencyIsActive ? emergencyStatusLabel : "Emergency"}
              </button>
            </section>

            {formError && <div className="notice notice--error">{formError}</div>}

            <div className="button-stack">
              <button type="submit" className="primary-button" disabled={!canSubmit}>
                {submitting ? "Submitting..." : "Submit report"}
              </button>
            </div>
          </form>
        )}
      </div>

      {tripViewOpen && (
        <div className="modal-backdrop" role="presentation" onClick={closeTripView}>
          <section
            className="confirm-modal trip-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trip-view-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="trip-modal__close"
              onClick={closeTripView}
              aria-label="Close active trip view"
            >
              <CloseIcon />
            </button>
            <div className="trip-modal__header">
              <p className="kicker">Active trip</p>
              <h2 id="trip-view-title">{tripViewTrip ? tripViewStatusLabel : "Loading trip view"}</h2>
              <p className="muted">
                {tripViewTrip?.tripStatus === "completed"
                  ? "Live tracking has stopped for this trip."
                  : "The map stays focused on the driver marker with short breadcrumb dots only."}
              </p>
            </div>

            {tripTrackingState === "loading" && (
              <div className="trip-modal__empty">
                <strong>Loading active trip...</strong>
                <span>Fetching the driver’s live trip data.</span>
              </div>
            )}

            {tripTrackingState === "error" && (
              <div className="trip-modal__empty trip-modal__empty--error">
                <strong>Unable to load the trip view</strong>
                <span>{tripTrackingError ?? "Please try again in a moment."}</span>
              </div>
            )}

            {tripTrackingState === "ready" && !tripViewTrip && (
              <div className="trip-modal__empty">
                <strong>No active trip right now</strong>
                <span>The driver does not have an ongoing trip at the moment.</span>
              </div>
            )}

            {tripTrackingState === "ready" && tripViewTrip && (
              <>
                <div className="trip-modal__summary">
                  <div>
                    <span>Driver</span>
                    <strong>{tripView.driverName}</strong>
                  </div>
                  <div>
                    <span>Plate / Unit</span>
                    <strong>{tripViewTrip.plateOrBodyNumber}</strong>
                  </div>
                  <div>
                    <span>Trip status</span>
                    <strong>{formatTripStatus(tripViewTrip.tripStatus)}</strong>
                  </div>
                  <div>
                    <span>Live status</span>
                    <strong>{tripViewStatusLabel}</strong>
                  </div>
                  <div>
                    <span>Trip timer</span>
                    <strong>{formatDuration(tripViewTrip.timerSeconds)}</strong>
                  </div>
                  <div>
                    <span>Distance traveled</span>
                    <strong>{formatDistance(tripViewTrip.distanceKilometers)}</strong>
                  </div>
                  <div>
                    <span>Current speed</span>
                    <strong>{formatSpeedLabel(tripViewTrip.speedKph)}</strong>
                  </div>
                  <div>
                    <span>Last updated</span>
                    <strong>{formatTimestamp(tripViewTrip.lastUpdatedAt)}</strong>
                  </div>
                </div>

                <div className="trip-map-shell trip-map-shell--modal">
                  <TriketrackMap
                    currentLocation={tripViewCurrentPoint}
                    breadcrumbPoints={
                      tripViewTrip.tripStatus === "ongoing" ? tripViewBreadcrumbs : []
                    }
                    routeCoordinates={
                      tripViewTrip.tripStatus === "completed" &&
                      tripViewTrip.finalRoute.status === "ready"
                        ? tripViewTrip.finalRoute.coordinates
                        : []
                    }
                    mapStyle="street"
                    showControls
                    showLocateButton={false}
                  />
                </div>

                <div className="trip-map-meta">
                  <div>
                    <span>Driver marker</span>
                    <strong>
                      {tripViewCurrentPoint
                        ? formatCoordinateLabel(tripViewCurrentPoint)
                        : "Waiting for location"}
                    </strong>
                  </div>
                  <div>
                    <span>Tracking status</span>
                    <strong>{tripViewStatusLabel}</strong>
                  </div>
                  <div>
                    <span>Route</span>
                    <strong>{tripViewTrip.routeName ?? "No route assigned yet"}</strong>
                  </div>
                  <div>
                    <span>Trip state</span>
                    <strong>
                      {tripViewTrip.tripStatus === "completed"
                        ? tripViewTrip.finalRoute.status === "ready"
                          ? "Trip has ended"
                          : "Final route is being processed"
                        : tripTrackingError ?? "Live trip updates connected"}
                    </strong>
                  </div>
                </div>

                <div className="trip-modal__actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      closeTripView()
                      window.scrollTo({ top: document.body.scrollHeight * 0.45, behavior: "smooth" })
                    }}
                  >
                    Report while viewing
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleEmergencyRequest}
                    disabled={emergencyBusy || emergencyIsActive}
                  >
                    {emergencyBusy
                      ? "Sending emergency..."
                      : emergencyIsActive
                        ? emergencyStatusLabel
                        : "Emergency / Report"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {confirmOpen && !submission && selectedCategory && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => !submitting && setConfirmOpen(false)}
        >
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-modal__icon confirm-modal__icon--danger">
              <CategoryIcon tone={getCategoryMeta(selectedCategory.code).tone} />
            </div>
            <h2 id="report-confirm-title">Submit {selectedCategory.label} report?</h2>
            <p className="muted">
              You are about to submit a <strong>{selectedCategory.label}</strong> report for{" "}
              <strong>{context.driverName}</strong>. This report will be reviewed by the admin team.
            </p>

            <div className="confirm-summary">
              <strong>What happens next:</strong>
              <ul>
                <li>Your report will be reviewed within the admin dashboard.</li>
                <li>Admin may contact you if you provided contact details.</li>
                <li>The attached photo proof will be saved with the report if included.</li>
              </ul>
            </div>

            <div className="button-stack">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void submitReport()}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Yes, submit"}
              </button>
            </div>
          </section>
        </div>
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
