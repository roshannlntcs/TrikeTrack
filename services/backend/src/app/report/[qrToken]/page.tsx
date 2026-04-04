import { getPassengerReportContextByQrToken, listReportTypes } from "../../../lib/reports-db"
import ReportSubmissionForm from "./report-submission-form"
import styles from "./page.module.css"

type ReportPageProps = {
  params: {
    qrToken: string
  }
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { qrToken } = params
  const [context, reportTypes] = await Promise.all([
    getPassengerReportContextByQrToken(qrToken),
    listReportTypes()
  ])

  if (!context) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <span className={styles.eyebrow}>Passenger Reporting</span>
          <h1 className={styles.title}>QR code not recognized</h1>
          <p className={styles.description}>
            This reporting link is invalid, expired, or no longer active. Please scan a current
            TrikeTrack QR code inside the tricycle.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroPanel}>
          <span className={styles.eyebrow}>Passenger Reporting</span>
          <h1 className={styles.title}>Report an incident for this trip</h1>
          <p className={styles.description}>
            Your report will be sent to the assigned admin team for review and verification.
          </p>
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span>Tricycle</span>
              <strong>{context.plateNo}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>Driver</span>
              <strong>{context.driverName ?? "No active driver linked"}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>TODA</span>
              <strong>{context.todaName}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>Route</span>
              <strong>{context.routeName ?? "No recent route available"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.formWrap}>
        <ReportSubmissionForm
          qrToken={qrToken}
          context={context}
          reportTypes={reportTypes}
        />
      </section>
    </main>
  )
}
