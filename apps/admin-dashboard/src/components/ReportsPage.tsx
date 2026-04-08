import { useEffect, useMemo, useState } from "react"
import {
  fetchAdminReports,
  updateAdminReportStatus,
  type AdminReportRecord,
  type ReportStatus,
  type ReportTypeRecord
} from "../lib/reports"
import "./ReportsPage.css"

type ReportsPageProps = {
  accessToken: string
  onDataChanged?: () => void
}

const REPORT_STATUS_OPTIONS: ReportStatus[] = [
  "submitted",
  "under_review",
  "verified",
  "resolved",
  "dismissed"
]

const formatReportStatus = (value: ReportStatus) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

const formatTripStatus = (value: AdminReportRecord["tripStatus"]) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : "No active trip"

export default function ReportsPage({ accessToken, onDataChanged }: ReportsPageProps) {
  const [reports, setReports] = useState<AdminReportRecord[]>([])
  const [reportTypes, setReportTypes] = useState<ReportTypeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyReportId, setBusyReportId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [draftStatuses, setDraftStatuses] = useState<Record<number, ReportStatus>>({})

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchAdminReports(accessToken)
        if (!active) return
        setReports(data.reports)
        setReportTypes(data.reportTypes)
        setDraftStatuses(
          Object.fromEntries(data.reports.map((report) => [report.reportId, report.status]))
        )
        setError(null)
      } catch (loadError) {
        if (!active) return
        setError(String(loadError))
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
  }, [accessToken])

  const normalizedSearchQuery = searchQuery.trim().toLowerCase()

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (statusFilter !== "all" && report.status !== statusFilter) {
        return false
      }

      if (typeFilter !== "all" && report.reportTypeCode !== typeFilter) {
        return false
      }

      if (!normalizedSearchQuery) return true

      return (
        report.driverName.toLowerCase().includes(normalizedSearchQuery) ||
        report.driverCode.toLowerCase().includes(normalizedSearchQuery) ||
        report.description.toLowerCase().includes(normalizedSearchQuery) ||
        (report.plateNo?.toLowerCase().includes(normalizedSearchQuery) ?? false) ||
        (report.routeName?.toLowerCase().includes(normalizedSearchQuery) ?? false) ||
        report.todaName.toLowerCase().includes(normalizedSearchQuery) ||
        report.barangayName.toLowerCase().includes(normalizedSearchQuery) ||
        report.reportTypeLabel.toLowerCase().includes(normalizedSearchQuery) ||
        (report.passengerName?.toLowerCase().includes(normalizedSearchQuery) ?? false) ||
        (report.passengerContact?.toLowerCase().includes(normalizedSearchQuery) ?? false)
      )
    })
  }, [reports, statusFilter, typeFilter, normalizedSearchQuery])

  const counts = useMemo(() => {
    return REPORT_STATUS_OPTIONS.reduce<Record<ReportStatus, number>>((totals, status) => {
      totals[status] = reports.filter((report) => report.status === status).length
      return totals
    }, {
      submitted: 0,
      under_review: 0,
      verified: 0,
      resolved: 0,
      dismissed: 0
    })
  }, [reports])

  const handleSaveStatus = async (report: AdminReportRecord) => {
    const nextStatus = draftStatuses[report.reportId] ?? report.status
    if (nextStatus === report.status) return

    setBusyReportId(report.reportId)
    try {
      const updated = await updateAdminReportStatus(accessToken, report.reportId, nextStatus)
      setReports((current) =>
        current.map((item) => (item.reportId === updated.reportId ? updated : item))
      )
      setDraftStatuses((current) => ({
        ...current,
        [updated.reportId]: updated.status
      }))
      setError(null)
      onDataChanged?.()
    } catch (updateError) {
      setError(String(updateError))
    } finally {
      setBusyReportId(null)
    }
  }

  return (
    <section className="page-stack reports-page">
      <section className="page-panel">
        <div className="page-panel__header">
          <div>
            <h2>Passenger Reports</h2>
            <p>
              {loading
                ? "Loading incident reports..."
                : `${filteredReports.length} reports visible across your admin scope`}
            </p>
          </div>
        </div>

        <div className="reports-summary">
          {REPORT_STATUS_OPTIONS.map((status) => (
            <article key={status} className="reports-summary__card">
              <span>{formatReportStatus(status)}</span>
              <strong>{counts[status]}</strong>
            </article>
          ))}
        </div>

        <div className="reports-toolbar">
          <input
            className="reports-toolbar__search"
            placeholder="Search driver, route, plate, TODA..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Search reports"
          />

          <select
            className="reports-toolbar__select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ReportStatus | "all")}
            aria-label="Filter reports by status"
          >
            <option value="all">All statuses</option>
            {REPORT_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {formatReportStatus(status)}
              </option>
            ))}
          </select>

          <select
            className="reports-toolbar__select"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            aria-label="Filter reports by category"
          >
            <option value="all">All categories</option>
            {reportTypes.map((type) => (
              <option key={type.reportTypeId} value={type.code}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="reports-error">{error}</div>}

        {loading ? (
          <div className="muted">Loading passenger reports...</div>
        ) : filteredReports.length === 0 ? (
          <div className="muted">
            {reports.length === 0
              ? "No passenger reports have been submitted yet."
              : "No reports match the current filters."}
          </div>
        ) : (
          <div className="reports-list">
            {filteredReports.map((report) => {
              const draftStatus = draftStatuses[report.reportId] ?? report.status
              const isBusy = busyReportId === report.reportId
              return (
                <article key={report.reportId} className="reports-card">
                  <div className="reports-card__top">
                    <div>
                      <div className="reports-card__titleRow">
                        <h3>{report.driverName}</h3>
                        <span className={`reports-status reports-status--${report.status}`}>
                          {formatReportStatus(report.status)}
                        </span>
                      </div>
                      <p>
                        {report.driverCode} | {report.plateNo ?? "No tricycle"} | {report.todaName} |{" "}
                        {report.barangayName}
                      </p>
                    </div>
                    <div className="reports-card__meta">
                      <strong>Report #{report.reportId}</strong>
                      <span>{new Date(report.reportedAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="reports-card__badges">
                    <span className="reports-chip">{report.reportTypeLabel}</span>
                    <span className="reports-chip">{formatTripStatus(report.tripStatus)}</span>
                    {report.tripId && <span className="reports-chip">Trip #{report.tripId}</span>}
                    <span className="reports-chip">QR #{report.qrId}</span>
                    {report.violationId && (
                      <span className="reports-chip">
                        Alert #{report.violationId} {report.violationStatus ? `(${report.violationStatus})` : ""}
                      </span>
                    )}
                  </div>

                  <div className="reports-card__route">
                    Route: {report.routeName ?? "No route attached"}
                  </div>
                  {(report.passengerName || report.passengerContact) && (
                    <div className="reports-card__route">
                      Passenger: {report.passengerName ?? "Anonymous"}
                      {report.passengerContact ? ` | ${report.passengerContact}` : ""}
                    </div>
                  )}
                  <div className="reports-card__description">{report.description}</div>
                  {report.mediaUrls && report.mediaUrls.length > 0 && (
                    <div className="reports-card__media">
                      <span className="reports-card__mediaLabel">Uploaded proof</span>
                      <div className="reports-card__mediaGrid">
                        {report.mediaUrls.map((mediaUrl, index) => (
                          <a
                            key={`${report.reportId}-${index}`}
                            className="reports-card__mediaLink"
                            href={mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open uploaded proof ${index + 1} for report ${report.reportId}`}
                          >
                            <img
                              className="reports-card__mediaImage"
                              src={mediaUrl}
                              alt={`Uploaded proof ${index + 1} for report ${report.reportId}`}
                              loading="lazy"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="reports-card__actions">
                    <select
                      className="reports-toolbar__select"
                      value={draftStatus}
                      onChange={(event) =>
                        setDraftStatuses((current) => ({
                          ...current,
                          [report.reportId]: event.target.value as ReportStatus
                        }))
                      }
                      disabled={isBusy}
                      aria-label={`Update status for report ${report.reportId}`}
                    >
                      {REPORT_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {formatReportStatus(status)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="reports-card__button"
                      onClick={() => void handleSaveStatus(report)}
                      disabled={isBusy || draftStatus === report.status}
                    >
                      {isBusy ? "Saving..." : "Save status"}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}
