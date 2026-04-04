"use client"

import { useState } from "react"
import type { PassengerReportContext, ReportTypeRecord } from "../../../lib/reports-db"
import styles from "./page.module.css"

type ReportSubmissionFormProps = {
  qrToken: string
  context: PassengerReportContext
  reportTypes: ReportTypeRecord[]
}

type SubmissionResult = {
  reportId: number
  status: string
}

export default function ReportSubmissionForm({
  qrToken,
  context,
  reportTypes
}: ReportSubmissionFormProps) {
  const [reportTypeCode, setReportTypeCode] = useState(reportTypes[0]?.code ?? "")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmissionResult | null>(null)

  const canSubmit =
    context.reportingAvailable &&
    reportTypeCode.length > 0 &&
    description.trim().length >= 12 &&
    !submitting

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/public/reporting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          qrToken,
          reportTypeCode,
          description: description.trim(),
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
        data?: {
          reportId: number
          status: string
        }
      }

      if (!response.ok || !payload.data) {
        throw new Error(payload.message ?? `Request failed with HTTP ${response.status}.`)
      }

      setResult({
        reportId: payload.data.reportId,
        status: payload.data.status
      })
      setDescription("")
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit report.")
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <section className={styles.card}>
        <span className={styles.eyebrow}>Report Submitted</span>
        <h2 className={styles.sectionTitle}>Thank you for reporting this incident</h2>
        <p className={styles.description}>
          Your report reference is <strong>#{result.reportId}</strong>. Admins can now review it
          and verify it against the assigned driver and trip.
        </p>
        <div className={styles.successRow}>
          <span className={styles.statusPill}>{result.status.replace("_", " ")}</span>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setResult(null)}
          >
            Submit another report
          </button>
        </div>
      </section>
    )
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <span className={styles.eyebrow}>Incident Details</span>
      <h2 className={styles.sectionTitle}>Tell us what happened</h2>
      <p className={styles.description}>
        Provide the incident type and a short description so admins can review it quickly.
      </p>

      <div className={styles.formField}>
        <label htmlFor="report-type">Category</label>
        <select
          id="report-type"
          value={reportTypeCode}
          onChange={(event) => setReportTypeCode(event.target.value)}
          disabled={!context.reportingAvailable || submitting}
        >
          {reportTypes.map((type) => (
            <option key={type.reportTypeId} value={type.code}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor="report-description">Description</label>
        <textarea
          id="report-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={6}
          placeholder="Describe the incident, including what happened and when it occurred."
          disabled={!context.reportingAvailable || submitting}
        />
      </div>

      {!context.reportingAvailable && (
        <div className={styles.warningBox}>
          {context.availabilityMessage ??
            "This QR code is not currently linked to an eligible trip for reporting."}
        </div>
      )}

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.formFooter}>
        <div className={styles.helperText}>
          Reports are reviewed by admins and can be linked to the assigned driver for follow-up.
        </div>
        <button type="submit" className={styles.primaryButton} disabled={!canSubmit}>
          {submitting ? "Submitting..." : "Submit report"}
        </button>
      </div>
    </form>
  )
}
