import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react"
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
  const [evidenceImage, setEvidenceImage] = useState<EvidenceImage | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submission, setSubmission] = useState<SubmissionPayload | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [emergencyConfirmOpen, setEmergencyConfirmOpen] = useState(false)
  const [emergencyAlert, setEmergencyAlert] = useState<EmergencyAlertRecord | null>(null)
  const [emergencyBusy, setEmergencyBusy] = useState(false)
  const [emergencyResponseOpen, setEmergencyResponseOpen] = useState(false)
  const [passengerLocation, setPassengerLocation] = useState<TriketrackMapCoordinate | null>(null)

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
        const response = await fetch(buildReportingUrl(reportingApi.apiBaseUrl, qrToken))
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
        setReportTypeCode(payload.data.reportTypes[0]?.code ?? "")
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
            </section>

            <section className="panel panel--map">
              <p className="kicker">Trip map</p>
              <p className="muted">
                Live GPS centers the map on your device. Switch between street, satellite, and
                terrain as needed.
              </p>
              <div className="trip-map-shell">
                <TriketrackMap
                  currentLocation={passengerLocation}
                  destination={emergencyMapPoint}
                  mapStyle="street"
                  showControls
                  showLocateButton
                  onLocationUpdate={setPassengerLocation}
                />
              </div>
              <div className="trip-map-meta">
                <div>
                  <span>Your location</span>
                  <strong>{formatCoordinateLabel(passengerLocation)}</strong>
                </div>
                <div>
                  <span>Destination marker</span>
                  <strong>
                    {emergencyMapPoint
                      ? emergencyAlert?.locationLabel ?? "Emergency location"
                      : "Not available yet"}
                  </strong>
                </div>
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
