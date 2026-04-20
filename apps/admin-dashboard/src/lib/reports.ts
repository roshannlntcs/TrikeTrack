export type ReportStatus =
  | "submitted"
  | "under_review"
  | "verified"
  | "resolved"
  | "dismissed"

export type AppealStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "denied"
  | "withdrawn"

export type ReportTypeRecord = {
  reportTypeId: number
  code: string
  label: string
}

export type AdminReportRecord = {
  reportId: number
  scanId: number
  tripId?: number
  tripStatus?: "scheduled" | "ongoing" | "completed" | "cancelled"
  reportTypeId: number
  reportTypeCode: string
  reportTypeLabel: string
  passengerName?: string
  passengerContact?: string
  description: string
  reportedAt: string
  status: ReportStatus
  driverId: number
  driverCode: string
  driverName: string
  tricycleId?: number
  plateNo?: string
  qrId: number
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  routeName?: string
  mediaUrls?: string[]
  violationId?: number
  violationStatus?: "open" | "under_review" | "resolved" | "dismissed"
}

export type AdminAppealRecord = {
  appealId: string
  violationId: string
  driverId: number
  driverCode: string
  driverName: string
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  tricycleId?: number
  plateNo?: string
  tripId?: number
  routeName?: string
  violationTypeCode: string
  violationTypeLabel: string
  violationStatus: "open" | "under_review" | "resolved"
  violationOccurredAt: string
  violationLocationLabel?: string
  appealReason: string
  appealMessage?: string
  status: AppealStatus
  submittedAt: string
  reviewedAt?: string
  decisionNotes?: string
  proofImageUrl?: string
  proofImageUrls: string[]
}

type AdminReportsResponse = {
  ok?: boolean
  message?: string
  data?: {
    reports: AdminReportRecord[]
    reportTypes: ReportTypeRecord[]
    appeals: AdminAppealRecord[]
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
