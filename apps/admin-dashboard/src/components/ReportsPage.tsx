import { useEffect, useMemo, useState } from "react"
import {
  fetchAdminReports,
  markAdminAppealViewed,
  updateAdminReportStatus,
  type AdminAppealRecord,
  type AdminReportRecord,
  type AppealStatus,
  type ReportStatus,
  type ReportTypeRecord
} from "../lib/reports"
import { supabase } from "../lib/supabase"
import "./ReportsPage.css"

type ReportsPageProps = {
  accessToken: string
  initialSection?: "reports" | "appeals"
  onDataChanged?: () => void
}

const REPORT_STATUS_OPTIONS: ReportStatus[] = [
  "submitted",
  "under_review",
  "verified",
  "resolved",
  "dismissed"
]

const APPEAL_STATUS_OPTIONS: Array<AppealStatus | "all"> = [
  "all",
  "submitted",
  "under_review",
  "approved",
  "denied",
  "withdrawn"
]

const formatReportStatus = (value: ReportStatus) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

const formatAppealStatus = (value: AppealStatus) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

const formatTripStatus = (value: AdminReportRecord["tripStatus"]) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : "No active trip"

const truncateText = (value: string | undefined, maxLength = 140) => {
  if (!value) return "No appeal message provided."
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength).trimEnd()}...`
}

const isPendingAppeal = (appeal: AdminAppealRecord) =>
  appeal.status === "submitted" || appeal.status === "under_review"

const isUnviewedPendingAppeal = (appeal: AdminAppealRecord) =>
  isPendingAppeal(appeal) && !appeal.viewedAt

export default function ReportsPage({
  accessToken,
  initialSection = "reports",
  onDataChanged
}: ReportsPageProps) {
  const [reports, setReports] = useState<AdminReportRecord[]>([])
  const [appeals, setAppeals] = useState<AdminAppealRecord[]>([])
  const [reportTypes, setReportTypes] = useState<ReportTypeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyReportId, setBusyReportId] = useState<number | null>(null)
  const [activeSection, setActiveSection] = useState<"reports" | "appeals">(initialSection)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [appealStatusFilter, setAppealStatusFilter] =
    useState<AppealStatus | "all">("all")
  const [draftStatuses, setDraftStatuses] = useState<Record<number, ReportStatus>>({})
  const [reloadTick, setReloadTick] = useState(0)
  const [selectedReport, setSelectedReport] = useState<AdminReportRecord | null>(null)
  const [selectedAppeal, setSelectedAppeal] = useState<AdminAppealRecord | null>(null)

  useEffect(() => {
    setActiveSection(initialSection)
  }, [initialSection])

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchAdminReports(accessToken)
        if (!active) return
        setReports(data.reports)
        setAppeals(data.appeals)
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
  }, [accessToken, reloadTick])

  useEffect(() => {
    const appealsChannel = supabase
      .channel("admin-driver-appeals")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "violation_appeals"
        },
        () => {
          setReloadTick((current) => current + 1)
          onDataChanged?.()
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "violation_proofs"
        },
        () => {
          setReloadTick((current) => current + 1)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(appealsChannel)
    }
  }, [onDataChanged])

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

  const filteredAppeals = useMemo(() => {
    return appeals.filter((appeal) => {
      if (appealStatusFilter !== "all" && appeal.status !== appealStatusFilter) {
        return false
      }

      if (!normalizedSearchQuery) return true

      return (
        appeal.driverName.toLowerCase().includes(normalizedSearchQuery) ||
        appeal.driverCode.toLowerCase().includes(normalizedSearchQuery) ||
        appeal.violationTypeLabel.toLowerCase().includes(normalizedSearchQuery) ||
        appeal.appealReason.toLowerCase().includes(normalizedSearchQuery) ||
        (appeal.appealMessage?.toLowerCase().includes(normalizedSearchQuery) ?? false) ||
        (appeal.plateNo?.toLowerCase().includes(normalizedSearchQuery) ?? false) ||
        (appeal.routeName?.toLowerCase().includes(normalizedSearchQuery) ?? false) ||
        appeal.todaName.toLowerCase().includes(normalizedSearchQuery) ||
        appeal.barangayName.toLowerCase().includes(normalizedSearchQuery)
      )
    })
  }, [appeals, appealStatusFilter, normalizedSearchQuery])

  const counts = useMemo(() => {
    return REPORT_STATUS_OPTIONS.reduce<Record<ReportStatus, number>>(
      (totals, status) => {
        totals[status] = reports.filter((report) => report.status === status).length
        return totals
      },
      {
        submitted: 0,
        under_review: 0,
        verified: 0,
        resolved: 0,
        dismissed: 0
      }
    )
  }, [reports])

  const appealCounts = useMemo(() => {
    return appeals.reduce<Record<AppealStatus, number>>(
      (totals, appeal) => {
        totals[appeal.status] += 1
        return totals
      },
      {
        submitted: 0,
        under_review: 0,
        approved: 0,
        denied: 0,
        withdrawn: 0
      }
    )
  }, [appeals])

  const activeAppealTabCount = useMemo(
    () => appeals.filter(isUnviewedPendingAppeal).length,
    [appeals]
  )

  const handleOpenAppeal = async (appeal: AdminAppealRecord) => {
    if (!appeal.viewedAt) {
      const optimisticViewedAt = new Date().toISOString()
      const nextAppeal = { ...appeal, viewedAt: optimisticViewedAt }

      setAppeals((current) =>
        current.map((item) =>
          item.appealId === appeal.appealId ? nextAppeal : item
        )
      )
      setSelectedAppeal(nextAppeal)

      try {
        const viewState = await markAdminAppealViewed(accessToken, appeal.appealId)
        setAppeals((current) =>
          current.map((item) =>
            item.appealId === viewState.appealId
              ? {
                  ...item,
                  viewedAt: viewState.viewedAt,
                  viewedByAdminId: viewState.viewedByAdminId
                }
              : item
          )
        )
        setSelectedAppeal((current) =>
          current?.appealId === viewState.appealId
            ? {
                ...current,
                viewedAt: viewState.viewedAt,
                viewedByAdminId: viewState.viewedByAdminId
              }
            : current
        )
      } catch (viewError) {
        setAppeals((current) =>
          current.map((item) =>
            item.appealId === appeal.appealId
              ? {
                  ...item,
                  viewedAt: appeal.viewedAt,
                  viewedByAdminId: appeal.viewedByAdminId
                }
              : item
          )
        )
        setSelectedAppeal((current) =>
          current?.appealId === appeal.appealId
            ? {
                ...current,
                viewedAt: appeal.viewedAt,
                viewedByAdminId: appeal.viewedByAdminId
              }
            : current
        )
        setError(String(viewError))
      }
      return
    }

    setSelectedAppeal(appeal)
  }

  useEffect(() => {
    if (!selectedAppeal) return

    const nextSelectedAppeal = appeals.find((appeal) => appeal.appealId === selectedAppeal.appealId)
    if (nextSelectedAppeal && nextSelectedAppeal !== selectedAppeal) {
      setSelectedAppeal(nextSelectedAppeal)
    }
  }, [appeals, selectedAppeal])

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
      <section className="page-panel reports-page__panel">
        <div className="reports-section-tabs" role="tablist" aria-label="Report views">
          <button
            type="button"
            className={`reports-section-tab${
              activeSection === "reports" ? " reports-section-tab--active" : ""
            }`}
            onClick={() => setActiveSection("reports")}
            role="tab"
            aria-selected={activeSection === "reports"}
          >
            <span>Passenger Reports</span>
            <strong>{reports.length}</strong>
          </button>
          <button
            type="button"
            className={`reports-section-tab${
              activeSection === "appeals" ? " reports-section-tab--active" : ""
            }`}
            onClick={() => setActiveSection("appeals")}
            role="tab"
            aria-selected={activeSection === "appeals"}
          >
            <span>Driver Appeals</span>
            <strong>{appeals.length}</strong>
            {activeAppealTabCount > 0 && <em>{activeAppealTabCount} new</em>}
          </button>
        </div>

        {activeSection === "reports" ? (
          <>
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
          </>
        ) : (
          <>
            <div className="reports-summary">
              {(["submitted", "under_review", "approved", "denied", "withdrawn"] as AppealStatus[]).map(
                (status) => (
                  <article key={status} className="reports-summary__card">
                    <span>{formatAppealStatus(status)}</span>
                    <strong>{appealCounts[status]}</strong>
                  </article>
                )
              )}
            </div>

            <div className="reports-toolbar">
              <input
                className="reports-toolbar__search"
                placeholder="Search driver, violation, route, TODA..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="Search appeals"
              />

              <select
                className="reports-toolbar__select"
                value={appealStatusFilter}
                onChange={(event) =>
                  setAppealStatusFilter(event.target.value as AppealStatus | "all")
                }
                aria-label="Filter appeals by status"
              >
                {APPEAL_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "All statuses" : formatAppealStatus(status)}
                  </option>
                ))}
              </select>

              <div className="reports-toolbar__summary">
                {activeAppealTabCount > 0
                  ? `${activeAppealTabCount} new appeal${activeAppealTabCount === 1 ? "" : "s"}`
                  : "No new appeal alerts"}
              </div>
            </div>
          </>
        )}

        <div className="reports-content">
          {error && <div className="reports-error">{error}</div>}

          {loading ? (
            <div className="muted">
              {activeSection === "reports"
                ? "Loading passenger reports..."
                : "Loading driver appeals..."}
            </div>
          ) : activeSection === "reports" ? (
            filteredReports.length === 0 ? (
              <div className="muted">
                {reports.length === 0
                  ? "No passenger reports have been submitted yet."
                  : "No reports match the current filters."}
              </div>
            ) : (
              <div className="reports-list">
                {filteredReports.map((report) => {
                  return (
                    <article
                      key={report.reportId}
                      className="reports-card reports-card--interactive"
                      onClick={() => setSelectedReport(report)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          setSelectedReport(report)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open report ${report.reportId}`}
                    >
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

                      <div className="reports-card__actions">
                        <div className="reports-card__appealMeta">
                          {report.passengerName
                            ? `Passenger: ${report.passengerName}`
                            : "Passenger: Anonymous"}
                        </div>
                        <button type="button" className="reports-card__button">
                          View report
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )
          ) : filteredAppeals.length === 0 ? (
            <div className="muted">
              {appeals.length === 0
                ? "No driver appeals have been submitted yet."
                : "No appeals match the current filters."}
            </div>
          ) : (
            <div className="reports-list">
              {filteredAppeals.map((appeal) => (
                <article
                  key={appeal.appealId}
                  className="reports-card reports-card--interactive"
                  onClick={() => handleOpenAppeal(appeal)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      handleOpenAppeal(appeal)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open appeal ${appeal.appealId}`}
                >
                  <div className="reports-card__top">
                    <div>
                      <div className="reports-card__titleRow">
                        <h3>{appeal.driverName}</h3>
                        <span className={`reports-status reports-status--${appeal.status}`}>
                          {formatAppealStatus(appeal.status)}
                        </span>
                      </div>
                      <p>
                        {appeal.driverCode} | {appeal.plateNo ?? "No tricycle"} | {appeal.todaName} |{" "}
                        {appeal.barangayName}
                      </p>
                    </div>
                    <div className="reports-card__meta">
                      <strong>Appeal</strong>
                      <span>{new Date(appeal.submittedAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="reports-card__badges">
                    <span className="reports-chip">{appeal.violationTypeLabel}</span>
                    <span className="reports-chip">Appeal: {appeal.appealReason}</span>
                    <span className="reports-chip">
                      Violation {appeal.violationStatus.replace("_", " ")}
                    </span>
                    {appeal.tripId && <span className="reports-chip">Trip #{appeal.tripId}</span>}
                  </div>

                  <div className="reports-card__route">
                    Route: {appeal.routeName ?? "No route attached"}
                  </div>
                  <div className="reports-card__route">
                    Submitted: {new Date(appeal.submittedAt).toLocaleString()}
                  </div>
                  <div className="reports-card__description">
                    {truncateText(appeal.appealMessage, 120)}
                  </div>

                  <div className="reports-card__actions">
                    <div className="reports-card__appealMeta">
                      Violation time: {new Date(appeal.violationOccurredAt).toLocaleString()}
                    </div>
                    <button type="button" className="reports-card__button">
                      View appeal
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedReport && (
        <div
          className="reports-modal-backdrop"
          role="presentation"
          onClick={() => setSelectedReport(null)}
        >
          <section
            className="reports-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="reports-modal__header">
              <div>
                <p className="reports-modal__eyebrow">Passenger report</p>
                <h3 id="report-modal-title">{selectedReport.driverName}</h3>
              </div>
              <button
                type="button"
                className="reports-modal__close"
                onClick={() => setSelectedReport(null)}
              >
                Close
              </button>
            </div>

            <div className="reports-card__badges">
              <span className="reports-chip">{selectedReport.reportTypeLabel}</span>
              <span className="reports-chip">{formatTripStatus(selectedReport.tripStatus)}</span>
              <span className={`reports-status reports-status--${selectedReport.status}`}>
                {formatReportStatus(selectedReport.status)}
              </span>
            </div>

            <div className="reports-modal__grid">
              <div>
                <span>Report ID</span>
                <strong>#{selectedReport.reportId}</strong>
              </div>
              <div>
                <span>Reported at</span>
                <strong>{new Date(selectedReport.reportedAt).toLocaleString()}</strong>
              </div>
              <div>
                <span>Driver code</span>
                <strong>{selectedReport.driverCode}</strong>
              </div>
              <div>
                <span>Plate / unit</span>
                <strong>{selectedReport.plateNo ?? "No tricycle assigned"}</strong>
              </div>
              <div>
                <span>TODA</span>
                <strong>{selectedReport.todaName}</strong>
              </div>
              <div>
                <span>Barangay</span>
                <strong>{selectedReport.barangayName}</strong>
              </div>
              <div>
                <span>Route</span>
                <strong>{selectedReport.routeName ?? "No route attached"}</strong>
              </div>
              <div>
                <span>Passenger</span>
                <strong>
                  {selectedReport.passengerName ?? "Anonymous"}
                  {selectedReport.passengerContact ? ` | ${selectedReport.passengerContact}` : ""}
                </strong>
              </div>
            </div>

            <div className="reports-modal__section">
              <span className="reports-card__mediaLabel">Description</span>
              <div className="reports-card__description">{selectedReport.description}</div>
            </div>

            <div className="reports-modal__section">
              <span className="reports-card__mediaLabel">Uploaded proof</span>
              {selectedReport.mediaUrls && selectedReport.mediaUrls.length > 0 ? (
                <div className="reports-card__mediaGrid">
                  {selectedReport.mediaUrls.map((mediaUrl, index) => (
                    <a
                      key={`${selectedReport.reportId}-${index}`}
                      className="reports-card__mediaLink"
                      href={mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        className="reports-card__mediaImage"
                        src={mediaUrl}
                        alt={`Uploaded proof ${index + 1} for report ${selectedReport.reportId}`}
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="reports-card__route">No uploaded proof for this report.</div>
              )}
            </div>

            <div className="reports-modal__section">
              <span className="reports-card__mediaLabel">Status</span>
              <div className="reports-modal__actions">
                <select
                  className="reports-toolbar__select"
                  value={draftStatuses[selectedReport.reportId] ?? selectedReport.status}
                  onChange={(event) =>
                    setDraftStatuses((current) => ({
                      ...current,
                      [selectedReport.reportId]: event.target.value as ReportStatus
                    }))
                  }
                  disabled={busyReportId === selectedReport.reportId}
                  aria-label={`Update status for report ${selectedReport.reportId}`}
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
                  onClick={() => void handleSaveStatus(selectedReport)}
                  disabled={
                    busyReportId === selectedReport.reportId ||
                    (draftStatuses[selectedReport.reportId] ?? selectedReport.status) ===
                      selectedReport.status
                  }
                >
                  {busyReportId === selectedReport.reportId ? "Saving..." : "Save status"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {selectedAppeal && (
        <div
          className="reports-modal-backdrop"
          role="presentation"
          onClick={() => setSelectedAppeal(null)}
        >
          <section
            className="reports-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="appeal-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="reports-modal__header">
              <div>
                <p className="reports-modal__eyebrow">Driver Appeal</p>
                <h3 id="appeal-modal-title">{selectedAppeal.driverName}</h3>
              </div>
              <button
                type="button"
                className="reports-modal__close"
                onClick={() => setSelectedAppeal(null)}
              >
                Close
              </button>
            </div>

            <div className="reports-card__badges">
              <span className="reports-chip">{selectedAppeal.violationTypeLabel}</span>
              <span className="reports-chip">Appeal: {selectedAppeal.appealReason}</span>
              <span className={`reports-status reports-status--${selectedAppeal.status}`}>
                {formatAppealStatus(selectedAppeal.status)}
              </span>
            </div>

            <div className="reports-modal__grid">
              <div>
                <span>Driver Code</span>
                <strong>{selectedAppeal.driverCode}</strong>
              </div>
              <div>
                <span>Plate / Unit</span>
                <strong>{selectedAppeal.plateNo ?? "No tricycle assigned"}</strong>
              </div>
              <div>
                <span>Submitted</span>
                <strong>{new Date(selectedAppeal.submittedAt).toLocaleString()}</strong>
              </div>
              <div>
                <span>Violation Status</span>
                <strong>{selectedAppeal.violationStatus.replace("_", " ")}</strong>
              </div>
              <div>
                <span>TODA</span>
                <strong>{selectedAppeal.todaName}</strong>
              </div>
              <div>
                <span>Route</span>
                <strong>{selectedAppeal.routeName ?? "No route attached"}</strong>
              </div>
            </div>

            <div className="reports-modal__section">
              <span className="reports-card__mediaLabel">Appeal message</span>
              <div className="reports-card__description">
                {selectedAppeal.appealMessage ?? "No appeal message provided."}
              </div>
            </div>

            <div className="reports-modal__section">
              <span className="reports-card__mediaLabel">Proof image</span>
              {selectedAppeal.proofImageUrls.length > 0 ? (
                <div className="reports-card__mediaGrid">
                  {selectedAppeal.proofImageUrls.map((proofUrl, index) => (
                    <a
                      key={`${selectedAppeal.appealId}-${index}`}
                      className="reports-card__mediaLink"
                      href={proofUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        className="reports-card__mediaImage"
                        src={proofUrl}
                        alt={`Proof ${index + 1} for ${selectedAppeal.driverName}`}
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="reports-card__route">No proof image uploaded for this appeal.</div>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
