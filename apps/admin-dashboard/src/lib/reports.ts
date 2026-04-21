import { getSnapshot, saveSnapshot, type CachedSnapshot } from "./db"

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
  viewedAt?: string
  viewedByAdminId?: number
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

type AdminReportsData = NonNullable<AdminReportsResponse["data"]> & {
  cacheMeta?: {
    fromCache: boolean
    savedAt: string
  }
}

const REPORTS_CACHE_KEY = "admin-reports"

const withCacheMeta = <TData extends object>(cached: CachedSnapshot<TData>) => ({
  ...cached.data,
  cacheMeta: {
    fromCache: true,
    savedAt: new Date(cached.savedAt).toISOString()
  }
})

type AdminReportUpdateResponse = {
  ok?: boolean
  message?: string
  data?: AdminReportRecord
}

type AdminAppealViewUpdateResponse = {
  ok?: boolean
  message?: string
  data?: {
    appealId: string
    viewedAt: string
    viewedByAdminId?: number
  }
}

export const fetchAdminReports = async (accessToken: string) => {
  try {
    const response = await fetch("/api/admin/reports", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    const payload = (await response.json().catch(() => ({}))) as AdminReportsResponse
    if (!response.ok || !payload.data) {
      throw new Error(payload.message ?? `Reports API returned HTTP ${response.status}.`)
    }

    await saveSnapshot(REPORTS_CACHE_KEY, payload.data)
    return payload.data
  } catch (error) {
    const cached = await getSnapshot<AdminReportsData>(REPORTS_CACHE_KEY)
    if (cached) {
      return withCacheMeta(cached)
    }
    throw error
  }
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

export const markAdminAppealViewed = async (accessToken: string, appealId: string) => {
  const response = await fetch("/api/admin/reports", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "markAppealViewed",
      appealId
    })
  })

  const payload = (await response.json().catch(() => ({}))) as AdminAppealViewUpdateResponse
  if (!response.ok || !payload.data) {
    throw new Error(payload.message ?? `Reports API returned HTTP ${response.status}.`)
  }

  return payload.data
}
