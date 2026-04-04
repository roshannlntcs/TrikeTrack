export type ReportStatus =
  | "submitted"
  | "under_review"
  | "verified"
  | "resolved"
  | "dismissed"

export type ReportTypeRecord = {
  reportTypeId: number
  code: string
  label: string
}

export type AdminReportRecord = {
  reportId: number
  scanId: number
  tripId: number
  tripStatus: "scheduled" | "ongoing" | "completed" | "cancelled"
  reportTypeId: number
  reportTypeCode: string
  reportTypeLabel: string
  description: string
  reportedAt: string
  status: ReportStatus
  driverId: number
  driverCode: string
  driverName: string
  tricycleId: number
  plateNo: string
  qrId: number
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  routeName: string
  violationId?: number
  violationStatus?: "open" | "under_review" | "resolved" | "dismissed"
}

type AdminReportsResponse = {
  ok?: boolean
  message?: string
  data?: {
    reports: AdminReportRecord[]
    reportTypes: ReportTypeRecord[]
  }
}

type AdminReportUpdateResponse = {
  ok?: boolean
  message?: string
  data?: AdminReportRecord
}

export const fetchAdminReports = async (accessToken: string) => {
  const response = await fetch("/api/admin/reports", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  const payload = (await response.json().catch(() => ({}))) as AdminReportsResponse
  if (!response.ok || !payload.data) {
    throw new Error(payload.message ?? `Reports API returned HTTP ${response.status}.`)
  }

  return payload.data
}

export const updateAdminReportStatus = async (
  accessToken: string,
  reportId: number,
  status: ReportStatus
) => {
  const response = await fetch("/api/admin/reports", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      reportId,
      status
    })
  })

  const payload = (await response.json().catch(() => ({}))) as AdminReportUpdateResponse
  if (!response.ok || !payload.data) {
    throw new Error(payload.message ?? `Reports API returned HTTP ${response.status}.`)
  }

  return payload.data
}
