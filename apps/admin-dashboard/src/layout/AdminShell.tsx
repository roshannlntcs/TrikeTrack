import { useEffect, useMemo, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import * as turf from "@turf/turf"
import type { GeoJSON as MapGeoJSON } from "../types/geojson"
import type { DriverLocationEvent, ViolationEvent } from "../../../../common/types"
import type { AdminProfile } from "../lib/admin-profile"
import {
  fetchDashboardData,
  type DashboardDataSnapshot,
  type DashboardDriverRecord,
  type DashboardTripRecord,
  type DashboardViolationRecord
} from "../lib/dashboard-data"
import geofenceRaw from "../data/geofence.geojson?raw"
import { enqueueViolation, getOutboxCount, savePoint } from "../lib/db"
import { syncOutbox } from "../lib/outbox"
import { supabase } from "../lib/supabase"
import ReportsPage from "../components/ReportsPage"
import SuperadminPage from "../superadmin/SuperadminPage"
import TodaManagementPage from "../toda/TodaManagementPage"
import "./AdminShell.css"

type DriverStreamState = {
  driverId: string
  lastSeenTs: number
  latestPoint: DriverLocationEvent
  violationCount: number
  recentPoints: DriverLocationEvent[]
}

type NavKey =
  | "superadmin"
  | "toda-admin"
  | "home"
  | "live-map"
  | "drivers"
  | "tricycles"
  | "alerts"
  | "reports"
  | "trip-logs"

type NavItem = {
  key: NavKey
  label: string
}

const BASE_NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Home" },
  { key: "live-map", label: "Live Map" },
  { key: "drivers", label: "Drivers" },
  { key: "alerts", label: "Alerts" },
  { key: "reports", label: "Reports" },
  { key: "trip-logs", label: "Trip Logs" }
]

const TODA_NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Home" },
  { key: "live-map", label: "Live Map" },
  { key: "drivers", label: "Drivers" },
  { key: "tricycles", label: "Tricycles" },
  { key: "alerts", label: "Alerts" },
  { key: "reports", label: "Reports" },
  { key: "trip-logs", label: "Trip Logs" }
]

const ROUTE_ID = "umasa-brgy-18b-geofence"
const DRIVER_OFFLINE_MS = 15000
const VIOLATION_DEDUP_MS = 60000
const RECENT_POINTS_PER_DRIVER = 8
const MAX_ALERTS = 40
const OUTBOX_SYNC_MS = 5000
const MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
const OBRERO_CENTER: [number, number] = [125.6128, 7.0848]
const DAVAO_CITY_BOUNDS: [[number, number], [number, number]] = [
  [125.48, 6.96],
  [125.71, 7.18]
]
const DEFAULT_CITY_ZOOM = 11
const HOME_ALERT_SUMMARY_LIMIT = 5
const HOME_TRIP_LOG_SUMMARY_LIMIT = 6
const ALERT_URGENT_WINDOW_MS = 15 * 60 * 1000
const NOTIFICATION_TRIP_WINDOW_MS = 24 * 60 * 60 * 1000
const NOTIFICATION_DRIVER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const NOTIFICATION_LIMIT = 12

type NotificationCategoryFilter = "all" | NotificationItem["kind"]
type NotificationRecencyFilter = "all" | "24h" | "7d" | "30d"

const ALERT_REASON_PRIORITY: Record<string, number> = {
  EMERGENCY: 100,
  PANIC: 100,
  COLLISION: 95,
  SPEED: 80,
  OUTSIDE_ROUTE_CORRIDOR: 60
}

const formatLastSeen = (lastSeenTs: number, nowTs: number) => {
  const diffSeconds = Math.max(0, Math.floor((nowTs - lastSeenTs) / 1000))
  if (diffSeconds < 60) return `${diffSeconds}s ago`
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  return `${diffHours}h ago`
}

const formatDriverCode = (driverId: number) => `D-${String(driverId).padStart(3, "0")}`

const formatPoint = (point: DriverLocationEvent) =>
  `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`

const formatAlertReason = (reason: ViolationEvent["reason"]) => {
  if (reason === "OUTSIDE_ROUTE_CORRIDOR") return "OUTSIDE_GEOFENCE_BOUNDARY"
  return reason
}

const getAlertPriority = (alert: { reason: string }) => {
  const normalizedReason = alert.reason.toUpperCase()
  for (const [reasonKey, score] of Object.entries(ALERT_REASON_PRIORITY)) {
    if (normalizedReason.includes(reasonKey)) return score
  }
  return 40
}

const formatRelativeTimestamp = (ts: number, nowTs: number) => {
  const diffMs = Math.max(0, nowTs - ts)
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return "Just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(ts).toLocaleDateString()
}

const sortNotificationsByRecency = (a: NotificationItem, b: NotificationItem) =>
  b.ts - a.ts || b.priority - a.priority

const getNotificationRecencyCutoff = (
  recencyFilter: NotificationRecencyFilter,
  nowTs: number
) => {
  if (recencyFilter === "24h") return nowTs - 24 * 60 * 60 * 1000
  if (recencyFilter === "7d") return nowTs - 7 * 24 * 60 * 60 * 1000
  if (recencyFilter === "30d") return nowTs - 30 * 24 * 60 * 60 * 1000
  return null
}

const getDateFilterStartTs = (value: string) => {
  if (!value) return null
  return new Date(`${value}T00:00:00`).getTime()
}

const getDateFilterEndTs = (value: string) => {
  if (!value) return null
  return new Date(`${value}T23:59:59.999`).getTime()
}

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : "-")

const formatFareAmount = (value?: number) =>
  value !== undefined ? `PHP ${value.toFixed(2)}` : "-"

const formatTripStatus = (value: DashboardTripRecord["tripStatus"]) =>
  value.charAt(0).toUpperCase() + value.slice(1)

type AdminShellProps = {
  onLogout: () => void
  adminProfile: AdminProfile
  accessToken: string
}

type LiveDriverLocationRow = {
  driver_id: number
  driver_code: string
  latitude: number
  longitude: number
  speed: number | null
  heading: number | null
  accuracy: number | null
  is_online: boolean
  recorded_at: string
  updated_at: string
}

type HandleLocationOptions = {
  queueViolation?: boolean
  cachePoint?: boolean
}

type DriverDirectoryRow = DashboardDriverRecord & {
  liveState?: DriverStreamState
}

type AlertListItem = {
  key: string
  driverId: string
  driverName?: string
  todaName?: string
  barangayName?: string
  ts: number
  reason: string
  description?: string
  status?: string
  lat?: number
  lng?: number
}

type NotificationItem = {
  key: string
  kind: "violation" | "trip" | "driver"
  page: Extract<NavKey, "alerts" | "trip-logs" | "drivers">
  title: string
  body: string
  ts: number
  priority: number
  tone: "danger" | "warn" | "info"
}

const createViolationNotification = (alert: AlertListItem): NotificationItem => {
  const driverLabel =
    alert.driverName ?? (alert.driverId === "N/A" ? "Unassigned driver" : `Driver ${alert.driverId}`)
  const details = [
    alert.reason,
    alert.description,
    [alert.barangayName, alert.todaName, alert.status].filter(Boolean).join(" | ")
  ].filter(Boolean)

  return {
    key: `notification-${alert.key}`,
    kind: "violation",
    page: "alerts",
    title: `${driverLabel} violation alert`,
    body: details.join(" • "),
    ts: alert.ts,
    priority: getAlertPriority(alert) + (alert.status === "open" ? 30 : 0),
    tone: "danger"
  }
}

const createTripNotification = (trip: DashboardTripRecord): NotificationItem => {
  const ts = new Date(trip.tripEnd ?? trip.tripStart).getTime()
  const title =
    trip.tripStatus === "ongoing"
      ? `Trip in progress for ${trip.driverName}`
      : trip.tripStatus === "cancelled"
        ? `Trip cancelled for ${trip.driverName}`
        : trip.tripStatus === "completed"
          ? `Trip completed for ${trip.driverName}`
          : `Trip scheduled for ${trip.driverName}`
  const priority =
    trip.tripStatus === "ongoing"
      ? 75
      : trip.tripStatus === "cancelled"
        ? 68
        : trip.tripStatus === "completed"
          ? 54
          : 42

  return {
    key: `notification-trip-${trip.tripId}-${trip.tripStatus}`,
    kind: "trip",
    page: "trip-logs",
    title,
    body: `${trip.plateNo} • ${trip.routeName} • ${trip.todaName}`,
    ts,
    priority,
    tone: trip.tripStatus === "cancelled" ? "warn" : "info"
  }
}

const createDriverNotification = (
  driver: DashboardDriverRecord,
  reason: "suspended" | "inactive" | "password_pending" | "new_driver"
): NotificationItem => {
  const ts = new Date(driver.createdAt).getTime()
  const driverLabel = `${driver.firstName} ${driver.lastName}`
  const title =
    reason === "suspended"
      ? `Driver suspended: ${driverLabel}`
      : reason === "inactive"
        ? `Driver inactive: ${driverLabel}`
        : reason === "password_pending"
          ? `Driver setup pending: ${driverLabel}`
          : `New driver added: ${driverLabel}`
  const priority =
    reason === "suspended"
      ? 72
      : reason === "inactive"
        ? 58
        : reason === "password_pending"
          ? 50
          : 38

  return {
    key: `notification-driver-${driver.driverId}-${reason}`,
    kind: "driver",
    page: "drivers",
    title,
    body: `${driver.driverCode} • ${driver.todaName} • Status ${driver.status}`,
    ts,
    priority,
    tone: reason === "suspended" ? "danger" : "warn"
  }
}

const BellIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 4.75a4 4 0 0 0-4 4v1.1c0 1.29-.36 2.56-1.03 3.67L5.8 15.44A1 1 0 0 0 6.65 17h10.7a1 1 0 0 0 .85-1.56l-1.17-1.92A7.06 7.06 0 0 1 16 9.85v-1.1a4 4 0 0 0-4-4Zm0 15.5a2.74 2.74 0 0 0 2.58-1.83h-5.16A2.74 2.74 0 0 0 12 20.25Z"
      fill="currentColor"
    />
  </svg>
)

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M20 12a8 8 0 1 1-2.34-5.66"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M20 4v6h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const createPointSignature = (point: Pick<DriverLocationEvent, "ts" | "lng" | "lat">) =>
  `${point.ts}|${point.lng.toFixed(5)}|${point.lat.toFixed(5)}`

const createLiveAlertListItem = (alert: ViolationEvent): AlertListItem => ({
  key: `live-${alert.driverId}-${alert.ts}`,
  driverId: alert.driverId,
  ts: alert.ts,
  reason: formatAlertReason(alert.reason),
  description: `Geofence deviation at ${alert.lat.toFixed(5)}, ${alert.lng.toFixed(5)}`,
  lat: alert.lat,
  lng: alert.lng,
  status: "open"
})

const createStoredAlertListItem = (alert: DashboardViolationRecord): AlertListItem => ({
  key: `stored-${alert.violationId}`,
  driverId: String(alert.driverId ?? "N/A"),
  driverName: alert.driverName,
  todaName: alert.todaName,
  barangayName: alert.barangayName,
  ts: new Date(alert.detectedAt).getTime(),
  reason: alert.violationTypeLabel,
  description: alert.description,
  status: alert.status
})

export default function AdminShell({
  onLogout,
  adminProfile,
  accessToken
}: AdminShellProps) {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const contentEl = useRef<HTMLElement | null>(null)
  const mapHeaderEl = useRef<HTMLDivElement | null>(null)
  const geofenceBoundsRef = useRef<[[number, number], [number, number]] | null>(null)
  const [activePage, setActivePage] = useState<NavKey>(
    adminProfile.role === "superadmin"
      ? "superadmin"
      : "home"
  )

  const [syncStatus, setSyncStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting")
  const [lastUpdateTs, setLastUpdateTs] = useState<number | null>(null)
  const [online, setOnline] = useState<boolean>(navigator.onLine)
  const [outboxCount, setOutboxCount] = useState<number>(0)
  const [outboxStatus, setOutboxStatus] = useState<
    "idle" | "syncing" | "error" | "offline"
  >("idle")
  const [alerts, setAlerts] = useState<ViolationEvent[]>([])
  const [driversById, setDriversById] = useState<Record<string, DriverStreamState>>(
    {}
  )
  const driversByIdRef = useRef<Record<string, DriverStreamState>>({})
  const [dashboardData, setDashboardData] = useState<DashboardDataSnapshot | null>(null)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [clockTs, setClockTs] = useState<number>(Date.now())
  const [liveMapCanvasHeight, setLiveMapCanvasHeight] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [lastNotificationReadTs, setLastNotificationReadTs] = useState<number>(0)
  const [isRefreshingNotifications, setIsRefreshingNotifications] = useState(false)
  const [notificationCategoryFilter, setNotificationCategoryFilter] =
    useState<NotificationCategoryFilter>("all")
  const [notificationRecencyFilter, setNotificationRecencyFilter] =
    useState<NotificationRecencyFilter>("all")
  const [notificationDateFrom, setNotificationDateFrom] = useState("")
  const [notificationDateTo, setNotificationDateTo] = useState("")
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<DriverDirectoryRow | null>(null)
  const visibleDriverIdentifiersRef = useRef<Set<string>>(new Set())
  const dashboardDriversRef = useRef<DashboardDriverRecord[]>([])
  const refreshLiveLocationsRef = useRef<(() => void) | null>(null)
  const notificationPanelRef = useRef<HTMLDivElement | null>(null)
  const trimmedSearchQuery = searchQuery.trim()
  const normalizedSearchQuery = trimmedSearchQuery.toLowerCase()
  const hasSearchQuery = normalizedSearchQuery.length > 0
  const showLiveMapView = activePage === "home" || activePage === "live-map"

  const refreshDashboardData = async () => {
    try {
      const snapshot = await fetchDashboardData(accessToken)
      setDashboardData(snapshot)
      setDashboardError(null)
    } catch (error) {
      setDashboardError(String(error))
    }
  }

  const refreshNotificationsAndAlerts = async () => {
    setIsRefreshingNotifications(true)
    try {
      await refreshDashboardData()
    } finally {
      setIsRefreshingNotifications(false)
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => setClockTs(Date.now()), 3000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let active = true
    let timer: number | undefined

    const load = async () => {
      try {
        const snapshot = await fetchDashboardData(accessToken)
        if (!active) return
        setDashboardData(snapshot)
        setDashboardError(null)
      } catch (error) {
        if (!active) return
        setDashboardError(String(error))
      }
    }

    void load()
    timer = window.setInterval(() => {
      void load()
    }, 15000)

    return () => {
      active = false
      if (timer) window.clearInterval(timer)
    }
  }, [accessToken])

  useEffect(() => {
    driversByIdRef.current = driversById
  }, [driversById])

  useEffect(() => {
    dashboardDriversRef.current = dashboardData?.drivers ?? []
    const identifiers = new Set<string>()
    for (const driver of dashboardData?.drivers ?? []) {
      identifiers.add(String(driver.driverId))
      identifiers.add(driver.driverCode.trim().toUpperCase())
    }
    visibleDriverIdentifiersRef.current = identifiers
    refreshLiveLocationsRef.current?.()
  }, [dashboardData?.drivers])

  useEffect(() => {
    if (!notificationsOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!notificationPanelRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false)
    }

    window.addEventListener("mousedown", handlePointerDown)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("mousedown", handlePointerDown)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [notificationsOpen])

  useEffect(() => {
    if (!selectedDriver) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedDriver(null)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedDriver])

  useEffect(() => {
    if (!profileModalOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileModalOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [profileModalOpen])

  useEffect(() => {
    if (!mapEl.current) return

    const geofence = JSON.parse(geofenceRaw) as MapGeoJSON
    const VIOLATION_SYNC_ENDPOINT =
      import.meta.env.VITE_VIOLATIONS_ENDPOINT || "/api/violations/batch"

    const map = new maplibregl.Map({
      container: mapEl.current,
      style: MAP_STYLE_URL,
      center: OBRERO_CENTER,
      zoom: DEFAULT_CITY_ZOOM,
      minZoom: 10,
      maxZoom: 19
    })
    mapRef.current = map
    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        visualizePitch: false
      }),
      "top-right"
    )

    map.on("error", (error) => {
      console.error("MapLibre error:", (error as any)?.error || error)
    })

    let liveLocationChannel:
      | ReturnType<typeof supabase.channel>
      | null = null
    let active = true
    let onlineHandler: (() => void) | null = null
    let outboxTimer: number | undefined
    let outboxOnlineHandler: (() => void) | null = null
    let stalePresenceTimer: number | undefined

    const markers = new Map<string, maplibregl.Marker>()
    const violationDedup = new Map<string, number>()

    const refreshOutboxCount = async () => {
      try {
        const count = await getOutboxCount()
        if (active) setOutboxCount(count)
      } catch (error) {
        console.warn("Outbox count failed:", error)
      }
    }

    const runOutboxSync = async () => {
      if (!active) return
      if (!navigator.onLine) {
        setOutboxStatus("offline")
        await refreshOutboxCount()
        return
      }

      setOutboxStatus("syncing")
      const result = await syncOutbox(VIOLATION_SYNC_ENDPOINT)
      await refreshOutboxCount()

      if (!active) return
      if (result.failed > 0) {
        setOutboxStatus("error")
      } else {
        setOutboxStatus("idle")
      }
    }

    const getDriverRecord = (driverIdentifier: string) => {
      const normalizedIdentifier = driverIdentifier.trim().toUpperCase()
      return dashboardDriversRef.current.find((driver) => {
        const normalizedCode = driver.driverCode.trim().toUpperCase()
        return (
          normalizedCode === normalizedIdentifier ||
          String(driver.driverId) === driverIdentifier
        )
      })
    }

    const getDriverLabel = (driverIdentifier: string) => {
      const driver = getDriverRecord(driverIdentifier)
      if (!driver) return driverIdentifier
      return `${driver.firstName} ${driver.lastName}`
    }

    const getDriverInitials = (driverIdentifier: string) => {
      const driver = getDriverRecord(driverIdentifier)
      if (driver) {
        return `${driver.firstName.charAt(0)}${driver.lastName.charAt(0)}`
          .toUpperCase()
          .slice(0, 2)
      }
      return driverIdentifier.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase() || "D"
    }

    const getDriverAvatarUrl = (driverIdentifier: string) => {
      const avatarUrl = getDriverRecord(driverIdentifier)?.avatarUrl?.trim()
      return avatarUrl ? avatarUrl : null
    }

    const renderMarkerFrameContent = (
      markerEl: HTMLDivElement,
      driverIdentifier: string
    ) => {
      const frameEl = markerEl.querySelector("[data-marker-frame]") as HTMLDivElement | null
      if (!frameEl) return

      frameEl.replaceChildren()
      const avatarUrl = getDriverAvatarUrl(driverIdentifier)
      if (avatarUrl) {
        const imageEl = document.createElement("img")
        imageEl.src = avatarUrl
        imageEl.alt = getDriverLabel(driverIdentifier)
        imageEl.style.width = "100%"
        imageEl.style.height = "100%"
        imageEl.style.objectFit = "cover"
        imageEl.style.borderRadius = "999px"
        imageEl.style.display = "block"
        imageEl.onerror = () => {
          frameEl.replaceChildren()
          frameEl.textContent = getDriverInitials(driverIdentifier)
        }
        frameEl.appendChild(imageEl)
        return
      }

      frameEl.textContent = getDriverInitials(driverIdentifier)
    }

    const applyMarkerTone = (markerEl: HTMLDivElement, inside: boolean) => {
      const frameEl = markerEl.querySelector("[data-marker-frame]") as HTMLDivElement | null
      const badgeEl = markerEl.querySelector("[data-marker-badge]") as HTMLDivElement | null
      if (frameEl) {
        frameEl.style.borderColor = inside ? "#22c55e" : "#ef4444"
        frameEl.style.boxShadow = inside
          ? "0 12px 28px rgba(34,197,94,0.28)"
          : "0 12px 28px rgba(239,68,68,0.28)"
      }
      if (badgeEl) {
        badgeEl.style.background = inside ? "#22c55e" : "#ef4444"
      }
    }

    const createMarkerElement = (driverIdentifier: string, inside: boolean) => {
      const markerEl = document.createElement("div")
      markerEl.style.width = "42px"
      markerEl.style.height = "42px"
      markerEl.style.position = "relative"
      markerEl.style.display = "flex"
      markerEl.style.alignItems = "center"
      markerEl.style.justifyContent = "center"
      markerEl.style.cursor = "pointer"

      const frameEl = document.createElement("div")
      frameEl.setAttribute("data-marker-frame", "true")
      frameEl.style.width = "36px"
      frameEl.style.height = "36px"
      frameEl.style.borderRadius = "999px"
      frameEl.style.border = "3px solid #22c55e"
      frameEl.style.background =
        "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.92))"
      frameEl.style.color = "#f8fafc"
      frameEl.style.display = "flex"
      frameEl.style.alignItems = "center"
      frameEl.style.justifyContent = "center"
      frameEl.style.fontSize = "12px"
      frameEl.style.fontWeight = "700"
      frameEl.style.fontFamily =
        "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      frameEl.style.boxSizing = "border-box"

      const badgeEl = document.createElement("div")
      badgeEl.setAttribute("data-marker-badge", "true")
      badgeEl.style.position = "absolute"
      badgeEl.style.right = "4px"
      badgeEl.style.bottom = "3px"
      badgeEl.style.width = "11px"
      badgeEl.style.height = "11px"
      badgeEl.style.borderRadius = "999px"
      badgeEl.style.border = "2px solid #ffffff"
      badgeEl.style.background = "#22c55e"
      badgeEl.style.boxSizing = "border-box"

      markerEl.appendChild(frameEl)
      markerEl.appendChild(badgeEl)
      markerEl.title = getDriverLabel(driverIdentifier)
      renderMarkerFrameContent(markerEl, driverIdentifier)
      applyMarkerTone(markerEl, inside)
      return markerEl
    }

    const isDriverVisibleToAdmin = (driverIdentifier: string) => {
      const driver = getDriverRecord(driverIdentifier)
      if (!driver || driver.status !== "active") return false
      if (adminProfile.role === "superadmin") return true
      const normalized = driverIdentifier.trim().toUpperCase()
      const visible = visibleDriverIdentifiersRef.current
      return visible.has(normalized) || visible.has(driverIdentifier)
    }

    const removeDriverState = (driverIdentifier: string) => {
      setDriversById((previous) => {
        if (!(driverIdentifier in previous)) return previous
        const next = { ...previous }
        delete next[driverIdentifier]
        return next
      })
    }

    const removeDriverMarker = (driverIdentifier: string) => {
      const marker = markers.get(driverIdentifier)
      if (!marker) return
      marker.remove()
      markers.delete(driverIdentifier)
    }

    const removeDriverLivePresence = (identifiers: string[]) => {
      for (const identifier of identifiers) {
        removeDriverMarker(identifier)
        removeDriverState(identifier)
      }
    }

    const isFreshLivePoint = (timestamp: number) => Date.now() - timestamp <= DRIVER_OFFLINE_MS

    const pruneStaleDriverPresence = () => {
      const staleIdentifiers = Object.entries(driversByIdRef.current)
        .filter(([, liveState]) => !isFreshLivePoint(liveState.lastSeenTs))
        .map(([driverIdentifier]) => driverIdentifier)

      if (staleIdentifiers.length > 0) {
        removeDriverLivePresence(staleIdentifiers)
      }
    }

    const upsertDriverState = (event: DriverLocationEvent, isViolation: boolean) => {
      setDriversById((previous) => {
        const existing = previous[event.driverId]
        const dedupedRecent = [event, ...(existing?.recentPoints ?? [])]
          .sort((a, b) => b.ts - a.ts)
          .filter((point, index, all) => {
            const signature = createPointSignature(point)
            return index === all.findIndex((candidate) => createPointSignature(candidate) === signature)
          })
          .slice(0, RECENT_POINTS_PER_DRIVER)
        return {
          ...previous,
          [event.driverId]: {
            driverId: event.driverId,
            lastSeenTs: Math.max(existing?.lastSeenTs ?? 0, event.ts),
            latestPoint: event,
            violationCount: (existing?.violationCount ?? 0) + (isViolation ? 1 : 0),
            recentPoints: dedupedRecent
          }
        }
      })
    }

    map.on("load", () => {
      const geofencePolygon = (geofence as any).features?.find(
        (feature: any) => feature.geometry?.type === "Polygon"
      )
      if (!geofencePolygon) {
        console.error("geofence.geojson is missing a Polygon feature.")
        return
      }

      const polygonRing = geofencePolygon.geometry?.coordinates?.[0] as number[][]
      if (!Array.isArray(polygonRing) || polygonRing.length < 4) {
        console.error("geofence.geojson Polygon ring must have at least 4 coordinates.")
        return
      }

      const geofencePolyline =
        (geofence as any).features?.find(
          (feature: any) => feature.geometry?.type === "LineString"
        ) ?? turf.polygonToLine(geofencePolygon as any)

      const geofencePoints = {
        type: "FeatureCollection",
        features: ((geofence as any).features ?? []).filter(
          (feature: any) => feature.geometry?.type === "Point"
        )
      }

      geofenceBoundsRef.current = DAVAO_CITY_BOUNDS
      map.setMaxBounds(DAVAO_CITY_BOUNDS)
      map.easeTo({
        center: OBRERO_CENTER,
        zoom: DEFAULT_CITY_ZOOM,
        duration: 0
      })

      map.addSource("area-geofence", {
        type: "geojson",
        data: geofencePolygon as any
      })
      map.addLayer({
        id: "area-geofence-fill",
        type: "fill",
        source: "area-geofence",
        paint: {
          "fill-color": "#0ea5e9",
          "fill-opacity": 0.12
        }
      })
      map.addLayer({
        id: "area-geofence-outline",
        type: "line",
        source: "area-geofence",
        paint: {
          "line-color": "#0284c7",
          "line-width": 2,
          "line-opacity": 0.9
        }
      })

      map.addSource("geofence-boundary", {
        type: "geojson",
        data: geofencePolyline as any
      })
      map.addLayer({
        id: "geofence-boundary-line",
        type: "line",
        source: "geofence-boundary",
        paint: {
          "line-color": "#2563eb",
          "line-width": 4,
          "line-opacity": 0.95
        }
      })

      if (geofencePoints.features.length > 0) {
        map.addSource("geofence-points", {
          type: "geojson",
          data: geofencePoints as any
        })
        map.addLayer({
          id: "geofence-points-layer",
          type: "circle",
          source: "geofence-points",
          paint: {
            "circle-color": "#ef4444",
            "circle-radius": 6,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff"
          }
        })
        map.addLayer({
          id: "geofence-points-labels",
          type: "symbol",
          source: "geofence-points",
          layout: {
            "text-field": ["to-string", ["coalesce", ["get", "pointNumber"], ""]],
            "text-size": 11,
            "text-anchor": "top",
            "text-offset": [0, 1.2]
          },
          paint: {
            "text-color": "#991b1b",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.2
          }
        })

        map.on("click", "geofence-points-layer", (event) => {
          const feature = event.features?.[0]
          if (!feature || feature.geometry.type !== "Point") return
          const coords = feature.geometry.coordinates as [number, number]
          const props = feature.properties as Record<string, unknown> | undefined
          const title = String(props?.name ?? "Boundary Point")
          const number = String(props?.pointNumber ?? "")
          const label = number ? `Point ${number}: ${title}` : title
          new maplibregl.Popup({ offset: 10 }).setLngLat(coords).setText(label).addTo(map)
        })

        map.on("mouseenter", "geofence-points-layer", () => {
          map.getCanvas().style.cursor = "pointer"
        })
        map.on("mouseleave", "geofence-points-layer", () => {
          map.getCanvas().style.cursor = ""
        })
      }

      const updateMarker = (event: DriverLocationEvent, inside: boolean) => {
        const existing = markers.get(event.driverId)
        if (existing) {
          existing.setLngLat([event.lng, event.lat])
          const markerEl = existing.getElement() as HTMLDivElement
          markerEl.title = getDriverLabel(event.driverId)
          renderMarkerFrameContent(markerEl, event.driverId)
          applyMarkerTone(markerEl, inside)
          return
        }
        const driverLabel = getDriverLabel(event.driverId)
        const markerEl = createMarkerElement(event.driverId, inside)
        const marker = new maplibregl.Marker({ element: markerEl })
          .setLngLat([event.lng, event.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 12 }).setHTML(
              `<strong>${driverLabel}</strong><br />${event.driverId}`
            )
          )
          .addTo(map)
        markers.set(event.driverId, marker)
      }

      const enqueueViolationEvent = async (event: DriverLocationEvent) => {
        const dedupKey = `${event.driverId}:OUTSIDE_ROUTE_CORRIDOR:${ROUTE_ID}`
        const lastTs = violationDedup.get(dedupKey) ?? 0
        if (event.ts - lastTs < VIOLATION_DEDUP_MS) return

        violationDedup.set(dedupKey, event.ts)
        const violationEvent: ViolationEvent = {
          type: "violation",
          driverId: event.driverId,
          ts: event.ts,
          lng: event.lng,
          lat: event.lat,
          reason: "OUTSIDE_ROUTE_CORRIDOR",
          routeId: ROUTE_ID,
          speed: event.speed,
          heading: event.heading,
          accuracy: event.accuracy
        }

        setAlerts((previous) => [violationEvent, ...previous].slice(0, MAX_ALERTS))

        await enqueueViolation({
          driverId: violationEvent.driverId,
          ts: violationEvent.ts,
          lng: violationEvent.lng,
          lat: violationEvent.lat,
          routeId: violationEvent.routeId,
          reason: violationEvent.reason,
          speed: violationEvent.speed,
          heading: violationEvent.heading,
          accuracy: violationEvent.accuracy
        })
        await refreshOutboxCount()
      }

      const handleLocationEvent = async (
        event: DriverLocationEvent,
        options: HandleLocationOptions = {}
      ) => {
        if (!isDriverVisibleToAdmin(event.driverId)) return
        const shouldQueueViolation = options.queueViolation ?? true
        const shouldCachePoint = options.cachePoint ?? true
        const inside = turf.booleanPointInPolygon(
          turf.point([event.lng, event.lat]),
          geofencePolygon as any
        )
        const isViolation = !inside

        updateMarker(event, inside)
        upsertDriverState(event, isViolation)

        if (isViolation && shouldQueueViolation) {
          await enqueueViolationEvent(event)
        }

        if (shouldCachePoint) {
          await savePoint({
            driverId: event.driverId,
            ts: event.ts,
            lng: event.lng,
            lat: event.lat,
            speed: event.speed,
            heading: event.heading,
            accuracy: event.accuracy,
            tripId: event.tripId,
            violation: isViolation
          })
        }
      }

      const toLocationEventFromRow = (
        row: LiveDriverLocationRow
      ): DriverLocationEvent => ({
        type: "driver_location",
        driverId: row.driver_code.trim().toUpperCase(),
        ts: new Date(row.recorded_at ?? row.updated_at).getTime(),
        lng: row.longitude,
        lat: row.latitude,
        speed: row.speed ?? undefined,
        heading: row.heading ?? undefined,
        accuracy: row.accuracy ?? undefined
      })

      const applyLocationRow = async (row: LiveDriverLocationRow) => {
        const identifiers = [row.driver_code.trim().toUpperCase(), String(row.driver_id)]
        if (!row.is_online) {
          removeDriverLivePresence(identifiers)
          return
        }

        const locationEvent = toLocationEventFromRow(row)
        if (!isFreshLivePoint(locationEvent.ts)) {
          removeDriverLivePresence(identifiers)
          return
        }
        if (!isDriverVisibleToAdmin(locationEvent.driverId)) {
          removeDriverLivePresence(identifiers)
          return
        }
        await handleLocationEvent(locationEvent, { queueViolation: true, cachePoint: false })
        if (active) setLastUpdateTs(locationEvent.ts)
      }

      const loadLiveDriverLocations = async () => {
        const hiddenIdentifiers = Object.keys(driversByIdRef.current).filter(
          (driverIdentifier) => !isDriverVisibleToAdmin(driverIdentifier)
        )
        if (hiddenIdentifiers.length > 0) {
          removeDriverLivePresence(hiddenIdentifiers)
        }

        setSyncStatus("connecting")
        const { data, error } = await supabase
          .from("driver_locations")
          .select(
            "driver_id,driver_code,latitude,longitude,speed,heading,accuracy,is_online,recorded_at,updated_at"
          )
          .eq("is_online", true)

        if (error) {
          console.warn("Live driver location hydration failed:", error.message)
          if (active) setSyncStatus("disconnected")
          return
        }

        for (const row of (data ?? []) as LiveDriverLocationRow[]) {
          await applyLocationRow(row)
        }

        if (active) setSyncStatus("connected")
      }

      refreshLiveLocationsRef.current = () => {
        void loadLiveDriverLocations()
      }

      const connectRealtime = () => {
        if (!active) return
        if (liveLocationChannel) {
          void supabase.removeChannel(liveLocationChannel)
          liveLocationChannel = null
        }

        setSyncStatus("connecting")
        liveLocationChannel = supabase
          .channel(`driver-locations-${adminProfile.adminId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "driver_locations"
            },
            (payload) => {
              if (!active) return
              const row = (payload.new || payload.old) as LiveDriverLocationRow | undefined
              if (!row) return
              void applyLocationRow(row)
            }
          )
          .subscribe((status) => {
            if (!active) return
            if (status === "SUBSCRIBED") {
              setSyncStatus("connected")
              return
            }
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              setSyncStatus("disconnected")
            }
          })
      }

      const handleOnlineState = () => {
        const isOnline = navigator.onLine
        setOnline(isOnline)
        if (isOnline) {
          void loadLiveDriverLocations()
          connectRealtime()
        } else {
          setSyncStatus("disconnected")
          setOutboxStatus("offline")
        }
      }

      onlineHandler = handleOnlineState
      window.addEventListener("online", handleOnlineState)
      window.addEventListener("offline", handleOnlineState)
      void loadLiveDriverLocations()
      connectRealtime()
    })

    void refreshOutboxCount()
    void runOutboxSync()
    outboxTimer = window.setInterval(() => {
      void runOutboxSync()
    }, OUTBOX_SYNC_MS)
      outboxOnlineHandler = () => {
        if (!navigator.onLine) setOutboxStatus("offline")
        void runOutboxSync()
      }
      window.addEventListener("online", outboxOnlineHandler)
      window.addEventListener("offline", outboxOnlineHandler)
      stalePresenceTimer = window.setInterval(pruneStaleDriverPresence, 3000)

      return () => {
        active = false
      if (refreshLiveLocationsRef.current) {
        refreshLiveLocationsRef.current = null
      }
      if (liveLocationChannel) {
        void supabase.removeChannel(liveLocationChannel)
      }
      if (onlineHandler) {
        window.removeEventListener("online", onlineHandler)
        window.removeEventListener("offline", onlineHandler)
      }
      if (outboxTimer) window.clearInterval(outboxTimer)
      if (stalePresenceTimer) window.clearInterval(stalePresenceTimer)
      if (outboxOnlineHandler) {
        window.removeEventListener("online", outboxOnlineHandler)
        window.removeEventListener("offline", outboxOnlineHandler)
      }
      for (const marker of markers.values()) {
        marker.remove()
      }
      map.remove()
      mapRef.current = null
      geofenceBoundsRef.current = null
    }
  }, [accessToken, adminProfile.adminId, adminProfile.role])

  useEffect(() => {
    if (showLiveMapView && mapRef.current) {
      window.setTimeout(() => {
        mapRef.current?.resize()
      }, 0)
    }
  }, [showLiveMapView])

  useEffect(() => {
    if (activePage !== "live-map") return

    let rafId: number | undefined
    const updateLiveMapHeight = () => {
      const contentHeight = contentEl.current?.clientHeight ?? 0
      const headerHeight = mapHeaderEl.current?.offsetHeight ?? 0
      if (!contentHeight || !headerHeight) return

      const nextHeight = Math.max(360, contentHeight - headerHeight - 2)
      setLiveMapCanvasHeight(nextHeight)
      rafId = window.requestAnimationFrame(() => {
        const map = mapRef.current
        if (!map) return
        map.resize()
      })
    }

    updateLiveMapHeight()
    window.addEventListener("resize", updateLiveMapHeight)

    return () => {
      window.removeEventListener("resize", updateLiveMapHeight)
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [activePage])

  const liveDriverRows = useMemo(() => {
    return Object.values(driversById).sort((a, b) => b.lastSeenTs - a.lastSeenTs)
  }, [driversById])

  const driverDirectoryRows = useMemo<DriverDirectoryRow[]>(() => {
    const directory = new Map<string, DriverDirectoryRow>()
    const knownDriverIdentifiers = new Set<string>()

    for (const driver of dashboardData?.drivers ?? []) {
      const numericDriverId = String(driver.driverId)
      knownDriverIdentifiers.add(numericDriverId)
      knownDriverIdentifiers.add(driver.driverCode)
      directory.set(numericDriverId, {
        ...driver,
        liveState: driversById[driver.driverCode] ?? driversById[numericDriverId]
      })
    }

    for (const liveDriver of liveDriverRows) {
      if (!knownDriverIdentifiers.has(liveDriver.driverId)) {
        directory.set(liveDriver.driverId, {
          driverId: Number(liveDriver.driverId) || 0,
          driverCode:
            Number(liveDriver.driverId) > 0
              ? formatDriverCode(Number(liveDriver.driverId))
              : liveDriver.driverId,
          todaId: 0,
          todaName: "Unassigned TODA",
          barangayId: 0,
          barangayName: "Unassigned Barangay",
          tricycleId: undefined,
          tricycleNo: undefined,
          qrId: undefined,
          passwordSet: false,
          firstName: "Live",
          lastName: `Driver ${liveDriver.driverId}`,
          contactNo: undefined,
          status: "active",
          createdAt: new Date(liveDriver.lastSeenTs).toISOString(),
          liveState: liveDriver
        })
      }
    }

    return [...directory.values()].sort((a, b) => {
      const aLastSeen = a.liveState?.lastSeenTs ?? 0
      const bLastSeen = b.liveState?.lastSeenTs ?? 0
      if (aLastSeen !== bLastSeen) return bLastSeen - aLastSeen
      return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
    })
  }, [dashboardData?.drivers, driversById, liveDriverRows])

  const activeDriverRows = useMemo(() => {
    return driverDirectoryRows.filter((driver) => {
      if (driver.status !== "active") return false
      const lastSeenTs = driver.liveState?.lastSeenTs ?? 0
      return lastSeenTs > 0 && clockTs - lastSeenTs <= DRIVER_OFFLINE_MS
    })
  }, [driverDirectoryRows, clockTs])

  const activeDriverCount = useMemo(() => {
    return activeDriverRows.length
  }, [activeDriverRows])

  const totalTripsToday = useMemo(() => {
    const today = new Date()
    return (dashboardData?.recentTrips ?? []).reduce((total, trip) => {
      const dt = new Date(trip.tripStart)
      return total + (dt.getFullYear() === today.getFullYear() &&
        dt.getMonth() === today.getMonth() &&
        dt.getDate() === today.getDate()
        ? 1
        : 0)
    }, 0)
  }, [dashboardData?.recentTrips])

  const filteredAllDriverRows = useMemo(() => {
    if (!hasSearchQuery) return driverDirectoryRows
    return driverDirectoryRows.filter((driver) => {
      const tripId = driver.liveState?.latestPoint.tripId ?? ""
      const driverName = `${driver.firstName} ${driver.lastName}`.toLowerCase()
      return (
        String(driver.driverId).toLowerCase().includes(normalizedSearchQuery) ||
        driver.driverCode.toLowerCase().includes(normalizedSearchQuery) ||
        driverName.includes(normalizedSearchQuery) ||
        driver.todaName.toLowerCase().includes(normalizedSearchQuery) ||
        driver.barangayName.toLowerCase().includes(normalizedSearchQuery) ||
        tripId.toLowerCase().includes(normalizedSearchQuery) ||
        (driver.liveState
          ? formatPoint(driver.liveState.latestPoint).toLowerCase().includes(normalizedSearchQuery)
          : false)
      )
    })
  }, [driverDirectoryRows, hasSearchQuery, normalizedSearchQuery])

  const filteredActiveDriverRows = useMemo(() => {
    if (!hasSearchQuery) return activeDriverRows
    return activeDriverRows.filter((driver) => {
      const tripId = driver.liveState?.latestPoint.tripId ?? ""
      const driverName = `${driver.firstName} ${driver.lastName}`.toLowerCase()
      return (
        String(driver.driverId).toLowerCase().includes(normalizedSearchQuery) ||
        driver.driverCode.toLowerCase().includes(normalizedSearchQuery) ||
        driverName.includes(normalizedSearchQuery) ||
        driver.todaName.toLowerCase().includes(normalizedSearchQuery) ||
        driver.barangayName.toLowerCase().includes(normalizedSearchQuery) ||
        tripId.toLowerCase().includes(normalizedSearchQuery) ||
        (driver.liveState
          ? formatPoint(driver.liveState.latestPoint).toLowerCase().includes(normalizedSearchQuery)
          : false)
      )
    })
  }, [activeDriverRows, hasSearchQuery, normalizedSearchQuery])

  const alertRows = useMemo<AlertListItem[]>(() => {
    const combined = [
      ...(dashboardData?.recentViolations ?? []).map(createStoredAlertListItem),
      ...alerts.map(createLiveAlertListItem)
    ]

    const deduped = new Map<string, AlertListItem>()
    for (const alert of combined) {
      const key = `${alert.driverId}|${alert.reason}|${alert.ts}`
      if (!deduped.has(key)) {
        deduped.set(key, alert)
      }
    }

    return [...deduped.values()].sort((a, b) => b.ts - a.ts)
  }, [dashboardData?.recentViolations, alerts])

  const filteredAlerts = useMemo(() => {
    if (!hasSearchQuery) return alertRows
    return alertRows.filter((alert) => {
      const point =
        alert.lat !== undefined && alert.lng !== undefined
          ? `${alert.lat.toFixed(5)}, ${alert.lng.toFixed(5)}`
          : ""
      return (
        alert.driverId.toLowerCase().includes(normalizedSearchQuery) ||
        (alert.driverName?.toLowerCase().includes(normalizedSearchQuery) ?? false) ||
        alert.reason.toLowerCase().includes(normalizedSearchQuery) ||
        (alert.description?.toLowerCase().includes(normalizedSearchQuery) ?? false) ||
        point.toLowerCase().includes(normalizedSearchQuery)
      )
    })
  }, [alertRows, hasSearchQuery, normalizedSearchQuery])

  const homeAlertSummary = useMemo(() => {
    const prioritized = [...filteredAlerts].sort((a, b) => {
      const priorityGap = getAlertPriority(b) - getAlertPriority(a)
      if (priorityGap !== 0) return priorityGap
      return b.ts - a.ts
    })
    const urgent = prioritized.filter((alert) => clockTs - alert.ts <= ALERT_URGENT_WINDOW_MS)
    const source = urgent.length > 0 ? urgent : prioritized
    return source.slice(0, HOME_ALERT_SUMMARY_LIMIT)
  }, [filteredAlerts, clockTs])

  const tripRows = useMemo(() => {
    return (dashboardData?.recentTrips ?? []).filter(
      (trip) => trip.tripStatus === "completed" && Boolean(trip.tripEnd)
    )
  }, [dashboardData?.recentTrips])

  const notificationItems = useMemo<NotificationItem[]>(() => {
    const violationItems = alertRows
      .filter((alert) => alert.status !== "resolved" && alert.status !== "dismissed")
      .slice(0, 6)
      .map(createViolationNotification)

    const tripItems = tripRows
      .filter((trip) => {
        const ts = new Date(trip.tripEnd ?? trip.tripStart).getTime()
        return clockTs - ts <= NOTIFICATION_TRIP_WINDOW_MS
      })
      .slice(0, 5)
      .map(createTripNotification)

    const driverItems = (dashboardData?.drivers ?? [])
      .flatMap((driver) => {
        const createdTs = new Date(driver.createdAt).getTime()
        if (driver.status === "suspended") {
          return [createDriverNotification(driver, "suspended")]
        }
        if (driver.status === "inactive") {
          return [createDriverNotification(driver, "inactive")]
        }
        if (!driver.passwordSet) {
          return [createDriverNotification(driver, "password_pending")]
        }
        if (clockTs - createdTs <= NOTIFICATION_DRIVER_WINDOW_MS) {
          return [createDriverNotification(driver, "new_driver")]
        }
        return []
      })
      .sort(sortNotificationsByRecency)
      .slice(0, 5)

    return [...violationItems, ...tripItems, ...driverItems]
      .sort(sortNotificationsByRecency)
      .slice(0, NOTIFICATION_LIMIT)
  }, [alertRows, tripRows, dashboardData?.drivers, clockTs])

  const filteredNotificationItems = useMemo(() => {
    const recencyCutoff = getNotificationRecencyCutoff(notificationRecencyFilter, clockTs)
    const startTs = getDateFilterStartTs(notificationDateFrom)
    const endTs = getDateFilterEndTs(notificationDateTo)

    return notificationItems.filter((item) => {
      if (notificationCategoryFilter !== "all" && item.kind !== notificationCategoryFilter) {
        return false
      }
      if (recencyCutoff !== null && item.ts < recencyCutoff) {
        return false
      }
      if (startTs !== null && item.ts < startTs) {
        return false
      }
      if (endTs !== null && item.ts > endTs) {
        return false
      }
      return true
    })
  }, [
    notificationItems,
    notificationCategoryFilter,
    notificationRecencyFilter,
    notificationDateFrom,
    notificationDateTo,
    clockTs
  ])

  const hasNotificationFilters =
    notificationCategoryFilter !== "all" ||
    notificationRecencyFilter !== "all" ||
    notificationDateFrom.length > 0 ||
    notificationDateTo.length > 0

  const unreadNotificationCount = useMemo(() => {
    return notificationItems.filter((item) => item.ts > lastNotificationReadTs).length
  }, [notificationItems, lastNotificationReadTs])

  useEffect(() => {
    if (!notificationsOpen) return
    const latestTs = notificationItems[0]?.ts ?? Date.now()
    setLastNotificationReadTs((current) => Math.max(current, latestTs))
  }, [notificationsOpen, notificationItems])

  const filteredTripRows = useMemo(() => {
    if (!hasSearchQuery) return tripRows
    return tripRows.filter((trip) => {
      return (
        String(trip.tripId).includes(trimmedSearchQuery) ||
        String(trip.driverId).includes(trimmedSearchQuery) ||
        trip.driverName.toLowerCase().includes(normalizedSearchQuery) ||
        trip.plateNo.toLowerCase().includes(normalizedSearchQuery) ||
        trip.routeName.toLowerCase().includes(normalizedSearchQuery) ||
        trip.todaName.toLowerCase().includes(normalizedSearchQuery) ||
        trip.barangayName.toLowerCase().includes(normalizedSearchQuery)
      )
    })
  }, [tripRows, hasSearchQuery, trimmedSearchQuery, normalizedSearchQuery])

  const homeTripLogSummary = useMemo(() => {
    if (filteredTripRows.length > 0) {
      return filteredTripRows.slice(0, HOME_TRIP_LOG_SUMMARY_LIMIT)
    }
    return filteredAllDriverRows.slice(0, HOME_TRIP_LOG_SUMMARY_LIMIT)
  }, [filteredAllDriverRows, filteredTripRows])

  const selectedDriverTripRows = useMemo(() => {
    if (!selectedDriver) return []

    return tripRows
      .filter((trip) => trip.driverId === selectedDriver.driverId)
      .sort((a, b) => {
        const aTs = new Date(a.tripEnd ?? a.tripStart).getTime()
        const bTs = new Date(b.tripEnd ?? b.tripStart).getTime()
        return bTs - aTs
      })
  }, [selectedDriver, tripRows])

  const navItems = useMemo<NavItem[]>(() => {
    if (adminProfile.role === "superadmin") {
      return [
        { key: "superadmin", label: "System Setup" },
        ...BASE_NAV_ITEMS
      ]
    }

    if (adminProfile.role === "toda_admin") {
      return TODA_NAV_ITEMS
    }

    return BASE_NAV_ITEMS
  }, [adminProfile.role])

  const pageLabel = navItems.find((item) => item.key === activePage)?.label ?? "Dashboard"
  const headerBarangay = adminProfile.barangayName ?? "Unassigned Barangay"
  const headerToda = adminProfile.todaName ?? "All TODAs"
  const profileInitials = adminProfile.email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "AD"
  const profileDisplayName = adminProfile.email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Admin User"
  const profileScope =
    adminProfile.role === "superadmin"
      ? "System Admin"
      : adminProfile.todaName
        ? `${adminProfile.role.replace("_", " ")} - ${adminProfile.todaName}`
        : adminProfile.barangayName
          ? `${adminProfile.role.replace("_", " ")} - ${adminProfile.barangayName}`
        : adminProfile.role.replace("_", " ")

  const openDriverModal = (driver: DriverDirectoryRow) => {
    setSelectedDriver(driver)
  }

  const closeDriverModal = () => {
    setSelectedDriver(null)
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <img
            src="/triketrack_logo.png"
            alt="TrikeTrack logo"
            className="sidebar-brand__logo"
          />
          <div>
            <div className="sidebar-brand__title">TRIKETRACK</div>
            <div className="sidebar-brand__subtitle">Admin Panel</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`sidebar-nav__item ${
                item.key === activePage ? "sidebar-nav__item--active" : ""
              }`}
              onClick={() => setActivePage(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button type="button" className="logout-button sidebar-logout" onClick={onLogout}>
          Log out
        </button>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-topbar__crumb">
              DASHBOARD / {headerBarangay.toUpperCase()}
            </div>
            <div className="admin-topbar__sub">TODA : {headerToda.toUpperCase()}</div>
          </div>

          <div className="admin-topbar__controls">
            <input
              className="topbar-search"
              placeholder="Search unit ID..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search by unit ID"
            />
            <div className="topbar-notifications" ref={notificationPanelRef}>
              <button
                type="button"
                className={`topbar-notification-button ${
                  notificationsOpen ? "topbar-notification-button--active" : ""
                }`}
                aria-haspopup="dialog"
                aria-expanded={notificationsOpen}
                aria-label={
                  unreadNotificationCount > 0
                    ? `${unreadNotificationCount} unread notifications`
                    : "Notifications"
                }
                onClick={() => setNotificationsOpen((current) => !current)}
              >
                <BellIcon />
                {unreadNotificationCount > 0 && (
                  <span className="topbar-notification-badge">
                    {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="topbar-notification-menu" role="dialog" aria-label="Notifications">
                  <div className="topbar-notification-menu__header">
                    <div>
                      <div className="topbar-notification-menu__title">Notifications</div>
                      <div className="topbar-notification-menu__subtitle">
                        Stored violations, trips, and driver updates shown newest first
                      </div>
                    </div>
                    <div className="topbar-notification-menu__actions">
                      <button
                        type="button"
                        className={`topbar-notification-refresh ${
                          isRefreshingNotifications
                            ? "topbar-notification-refresh--spinning"
                            : ""
                        }`}
                        onClick={() => void refreshNotificationsAndAlerts()}
                        disabled={isRefreshingNotifications}
                        aria-label="Refresh notifications and alerts"
                        title="Refresh notifications and alerts"
                      >
                        <RefreshIcon />
                      </button>
                      <div className="topbar-notification-menu__count">
                        {hasNotificationFilters
                          ? `${filteredNotificationItems.length}/${notificationItems.length}`
                          : notificationItems.length}
                      </div>
                    </div>
                  </div>

                  <div className="topbar-notification-filters">
                    <div className="topbar-notification-filter-grid">
                      <select
                        className="topbar-notification-filter"
                        aria-label="Filter notifications by category"
                        value={notificationCategoryFilter}
                        onChange={(event) =>
                          setNotificationCategoryFilter(
                            event.target.value as NotificationCategoryFilter
                          )
                        }
                      >
                        <option value="all">All categories</option>
                        <option value="violation">Alerts</option>
                        <option value="trip">Trips</option>
                        <option value="driver">Drivers</option>
                      </select>

                      <select
                        className="topbar-notification-filter"
                        aria-label="Filter notifications by recency"
                        value={notificationRecencyFilter}
                        onChange={(event) =>
                          setNotificationRecencyFilter(
                            event.target.value as NotificationRecencyFilter
                          )
                        }
                      >
                        <option value="all">All time</option>
                        <option value="24h">Last 24 hours</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                      </select>
                    </div>

                    <div className="topbar-notification-date-range">
                      <label className="topbar-notification-date-field">
                        <span>From</span>
                        <input
                          type="date"
                          value={notificationDateFrom}
                          max={notificationDateTo || undefined}
                          onChange={(event) => setNotificationDateFrom(event.target.value)}
                          aria-label="Filter notifications from date"
                        />
                      </label>

                      <label className="topbar-notification-date-field">
                        <span>To</span>
                        <input
                          type="date"
                          value={notificationDateTo}
                          min={notificationDateFrom || undefined}
                          onChange={(event) => setNotificationDateTo(event.target.value)}
                          aria-label="Filter notifications to date"
                        />
                      </label>
                    </div>

                    {hasNotificationFilters && (
                      <button
                        type="button"
                        className="topbar-notification-clear"
                        onClick={() => {
                          setNotificationCategoryFilter("all")
                          setNotificationRecencyFilter("all")
                          setNotificationDateFrom("")
                          setNotificationDateTo("")
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>

                  <div className="topbar-notification-list">
                    {filteredNotificationItems.length === 0 ? (
                      <div className="topbar-notification-empty">
                        {notificationItems.length === 0
                          ? "No important notifications yet."
                          : "No notifications match the selected filters."}
                      </div>
                    ) : (
                      filteredNotificationItems.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          className="topbar-notification-item"
                          onClick={() => {
                            setActivePage(item.page)
                            setNotificationsOpen(false)
                          }}
                        >
                          <span
                            className={`topbar-notification-item__icon topbar-notification-item__icon--${item.tone}`}
                            aria-hidden="true"
                          >
                            {item.kind === "violation" ? "!" : item.kind === "trip" ? "T" : "D"}
                          </span>
                          <span className="topbar-notification-item__content">
                            <span className="topbar-notification-item__title">{item.title}</span>
                            <span className="topbar-notification-item__body">{item.body}</span>
                          </span>
                          <span className="topbar-notification-item__time">
                            {formatRelativeTimestamp(item.ts, clockTs)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              className="topbar-profile topbar-profile--button"
              onClick={() => setProfileModalOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={profileModalOpen}
              aria-label="Open admin profile settings"
            >
              <div className="profile-avatar">{profileInitials}</div>
              <div>
                <div className="profile-name">{adminProfile.email}</div>
                <div className="profile-meta">{profileScope}</div>
              </div>
            </button>
          </div>
        </header>

        <main className="admin-content" ref={contentEl}>
          {dashboardError && activePage !== "superadmin" && activePage !== "toda-admin" && (
            <div className="page-panel" style={{ padding: "12px 14px", marginBottom: "14px" }}>
              <div className="muted">Dashboard data sync issue: {dashboardError}</div>
            </div>
          )}

          {activePage === "superadmin" && adminProfile.role === "superadmin" && (
            <SuperadminPage
              accessToken={accessToken}
              mode="superadmin"
              onDataChanged={() => void refreshDashboardData()}
            />
          )}

          {activePage === "toda-admin" && adminProfile.role === "toda_admin" && (
            <SuperadminPage
              accessToken={accessToken}
              mode="toda-admin"
              lockedTodaId={adminProfile.todaId}
              lockedTodaLabel={adminProfile.todaName}
              onDataChanged={() => void refreshDashboardData()}
            />
          )}

          {activePage === "home" && (
            <section className="page-stack">
              <div className="overview-grid">
                <article className="overview-card">
                  <div className="overview-card__label">Active Tricycles</div>
                  <div className="overview-card__value">
                    {activeDriverCount}
                    <span>/{dashboardData?.counts.tricycles ?? 0}</span>
                  </div>
                </article>

                <article className="overview-card">
                  <div className="overview-card__label">Active Alerts</div>
                  <div className="overview-card__value overview-card__value--danger">
                    {alertRows.length.toString().padStart(2, "0")}
                  </div>
                </article>

                <article className="overview-card">
                  <div className="overview-card__label">Total Trips Today</div>
                  <div className="overview-card__value">{totalTripsToday.toLocaleString()}</div>
                </article>

                <article className="overview-card">
                  <div className="overview-card__label">Registered Drivers</div>
                  <div className="overview-card__value">{dashboardData?.counts.drivers ?? 0}</div>
                </article>
              </div>

              <section className="home-summary-grid">
                <section className="page-panel">
                  <div className="page-panel__header page-panel__header--compact">
                    <div>
                      <h3>Alerts Highlights</h3>
                      <p>View alert details in the Alerts page.</p>
                    </div>
                    <button
                      type="button"
                      className="summary-link"
                      onClick={() => setActivePage("alerts")}
                    >
                      View all
                    </button>
                  </div>
                  <div className="alerts-list alerts-list--summary">
                    {homeAlertSummary.length === 0 ? (
                      <div className="muted">
                        {hasSearchQuery
                          ? `No alerts match "${trimmedSearchQuery}".`
                          : "No geofence boundary alerts yet."}
                      </div>
                    ) : (
                      homeAlertSummary.map((alert) => (
                        <div key={alert.key} className="alert-row">
                          <div className="alert-row__top">
                            <strong>{alert.driverName ?? `Driver ${alert.driverId}`}</strong>
                            <span>{new Date(alert.ts).toLocaleTimeString()}</span>
                          </div>
                          <div className="alert-row__meta">{alert.reason}</div>
                          {alert.description && (
                            <div className="alert-row__meta">{alert.description}</div>
                          )}
                          {alert.lat !== undefined && alert.lng !== undefined && (
                            <div className="alert-row__meta">
                              {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="page-panel">
                  <div className="page-panel__header page-panel__header--compact">
                    <div>
                      <h3>Trip Logs Summary</h3>
                      <p>View all trips in the Trip Logs page.</p>
                    </div>
                    <button
                      type="button"
                      className="summary-link"
                      onClick={() => setActivePage("trip-logs")}
                    >
                      View all
                    </button>
                  </div>
                  <div className="trip-logs-list trip-logs-list--summary">
                    {homeTripLogSummary.length === 0 ? (
                      <div className="muted">
                        {hasSearchQuery
                          ? `No trip logs match "${trimmedSearchQuery}".`
                          : "Trip stream will appear once messages arrive."}
                      </div>
                    ) : (
                      homeTripLogSummary.map((item) => {
                        if ("tripId" in item) {
                          return (
                            <div key={`trip-${item.tripId}`} className="trip-driver">
                              <div className="trip-driver__top">
                                <strong>{item.driverName}</strong>
                                <span>{item.tripStatus.toUpperCase()}</span>
                              </div>
                              <div className="trip-driver__meta">
                                Trip #{item.tripId} | {item.plateNo} | {item.routeName}
                              </div>
                            </div>
                          )
                        }

                        const isDriverOnline =
                          online &&
                          ((item.liveState?.lastSeenTs ?? 0) > 0) &&
                          clockTs - (item.liveState?.lastSeenTs ?? 0) <= DRIVER_OFFLINE_MS
                        return (
                          <div key={`driver-${item.driverId}`} className="trip-driver">
                            <div className="trip-driver__top">
                              <strong>{item.firstName} {item.lastName}</strong>
                              <span
                                className={
                                  isDriverOnline ? "status-badge online" : "status-badge offline"
                                }
                              >
                                {isDriverOnline ? "Online" : "Offline"}
                              </span>
                            </div>
                            <div className="trip-driver__meta">
                              {item.driverCode} | {item.todaName} | Status {item.status}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </section>
              </section>
            </section>
          )}

          <section
            className={`live-map-grid ${showLiveMapView ? "" : "page-hidden"} ${
              activePage === "home" ? "live-map-grid--home" : ""
            } ${activePage === "live-map" ? "live-map-grid--live" : ""}`}
          >
              <section className="page-panel page-panel--map">
                <div className="page-panel__header" ref={mapHeaderEl}>
                  <h2>Live Map</h2>
                  <p>UMASA TODA Geofence Boundary</p>
                </div>
                <div
                  className="admin-map"
                  ref={mapEl}
                  style={
                    activePage === "live-map" && liveMapCanvasHeight
                      ? { height: `${liveMapCanvasHeight}px` }
                      : undefined
                  }
                />
              </section>

              <aside className="live-map-side">
                <section className="page-panel side-card">
                  <div className="admin-pane__title">Sync Status</div>
                  <div className="meta-grid">
                    <div>Network</div>
                    <div>{online ? "Online" : "Offline"}</div>
                    <div>Realtime</div>
                    <div>{syncStatus}</div>
                    <div>Outbox</div>
                    <div>
                      {outboxCount} pending ({outboxStatus})
                    </div>
                    <div>Last data update</div>
                    <div>{lastUpdateTs ? new Date(lastUpdateTs).toLocaleTimeString() : "-"}</div>
                  </div>
                </section>

                <section className="page-panel side-card">
                  <div className="admin-pane__title">Drivers</div>
                  <div className="drivers-list">
                    {filteredActiveDriverRows.length === 0 ? (
                      <div className="muted">
                        {hasSearchQuery
                          ? `No drivers match "${trimmedSearchQuery}".`
                          : "No active drivers yet."}
                      </div>
                    ) : (
                      filteredActiveDriverRows.slice(0, 8).map((driver) => {
                        const isDriverOnline =
                          online &&
                          ((driver.liveState?.lastSeenTs ?? 0) > 0) &&
                          clockTs - (driver.liveState?.lastSeenTs ?? 0) <= DRIVER_OFFLINE_MS
                        return (
                          <div
                            className="driver-row driver-row--interactive"
                            key={driver.driverId}
                            role="button"
                            tabIndex={0}
                            onClick={() => openDriverModal(driver)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                openDriverModal(driver)
                              }
                            }}
                          >
                            <div className="driver-row__top">
                              <strong>{driver.firstName} {driver.lastName}</strong>
                              <span
                                className={
                                  isDriverOnline
                                    ? "status-badge online"
                                    : "status-badge offline"
                                }
                              >
                                {isDriverOnline ? "Online" : "Offline"}
                              </span>
                            </div>
                            <div className="driver-row__meta">
                              {driver.driverCode} | {driver.todaName}
                            </div>
                            <div className="driver-row__meta">
                              {driver.tricycleNo
                                ? `Tricycle ${driver.tricycleNo}`
                                : "No tricycle assigned"}
                              {driver.qrId ? ` | QR #${driver.qrId}` : ""}
                            </div>
                            <div className="driver-row__meta">
                              {driver.liveState
                                ? `Point ${formatPoint(driver.liveState.latestPoint)}`
                                : "Waiting for live GPS point"}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </section>

              </aside>
          </section>

          {activePage === "drivers" && (
            adminProfile.role === "toda_admin" ? (
              <TodaManagementPage
                accessToken={accessToken}
                page="drivers"
                lockedTodaId={adminProfile.todaId}
                lockedTodaLabel={adminProfile.todaName}
                onDataChanged={() => void refreshDashboardData()}
              />
            ) : (
              <section className="page-panel page-stack">
                <div className="page-panel__header">
                  <h2>Drivers</h2>
                  <p>
                    {hasSearchQuery
                      ? `${filteredAllDriverRows.length} matches for "${trimmedSearchQuery}"`
                      : `${driverDirectoryRows.length} tracked drivers`}
                  </p>
                </div>
                <div className="drivers-list drivers-list--page">
                  {filteredAllDriverRows.length === 0 ? (
                    <div className="muted">
                      {hasSearchQuery ? `No drivers match "${trimmedSearchQuery}".` : "No drivers yet."}
                    </div>
                  ) : (
                    filteredAllDriverRows.map((driver) => {
                      const isDriverOnline =
                        online &&
                        ((driver.liveState?.lastSeenTs ?? 0) > 0) &&
                        clockTs - (driver.liveState?.lastSeenTs ?? 0) <= DRIVER_OFFLINE_MS
                      return (
                        <div
                          className="driver-row driver-row--interactive"
                          key={driver.driverId}
                          role="button"
                          tabIndex={0}
                          onClick={() => openDriverModal(driver)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              openDriverModal(driver)
                            }
                          }}
                        >
                          <div className="driver-row__top">
                            <strong>{driver.firstName} {driver.lastName}</strong>
                            <span
                              className={
                                isDriverOnline ? "status-badge online" : "status-badge offline"
                              }
                            >
                              {isDriverOnline ? "Online" : "Offline"}
                            </span>
                          </div>
                          <div className="driver-row__meta">
                            {driver.driverCode} | {driver.barangayName} | {driver.todaName}
                          </div>
                          <div className="driver-row__meta">
                            {driver.tricycleNo
                              ? `Tricycle ${driver.tricycleNo}`
                              : "No tricycle assigned"}
                            {driver.qrId ? ` | QR #${driver.qrId}` : ""}
                            {` | Password ${driver.passwordSet ? "set" : "pending"}`}
                          </div>
                          <div className="driver-row__meta">
                            {driver.liveState
                              ? `Last seen ${formatLastSeen(driver.liveState.lastSeenTs, clockTs)}`
                              : "No live point yet"}
                          </div>
                          <div className="driver-row__meta">
                            {driver.liveState
                              ? `Point ${formatPoint(driver.liveState.latestPoint)}`
                              : `Status ${driver.status}`}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>
            )
          )}

          {selectedDriver && (
            <div
              className="driver-modal-backdrop"
              role="presentation"
              onClick={closeDriverModal}
            >
              <div
                className="driver-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="driver-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="driver-modal__header">
                  <div>
                    <h3 id="driver-modal-title">
                      {selectedDriver.firstName} {selectedDriver.lastName}
                    </h3>
                    <p>
                      {selectedDriver.driverCode} | {selectedDriver.barangayName} | {selectedDriver.todaName}
                    </p>
                  </div>
                  <button type="button" className="driver-modal__close" onClick={closeDriverModal}>
                    Close
                  </button>
                </div>

                <div className="driver-modal__body">
                  <section className="driver-modal__summary">
                    <div className="driver-modal__card">
                      <span className="driver-modal__label">Status</span>
                      <strong>{selectedDriver.status}</strong>
                    </div>
                    <div className="driver-modal__card">
                      <span className="driver-modal__label">Assigned Tricycle</span>
                      <strong>{selectedDriver.tricycleNo ? `Tricycle ${selectedDriver.tricycleNo}` : "No tricycle assigned"}</strong>
                    </div>
                    <div className="driver-modal__card">
                      <span className="driver-modal__label">Password</span>
                      <strong>{selectedDriver.passwordSet ? "Set" : "Pending"}</strong>
                    </div>
                  </section>

                  <section className="driver-modal__details">
                    <div className="driver-modal__card">
                      <span className="driver-modal__label">Contact</span>
                      <strong>{selectedDriver.contactNo ?? "No contact provided"}</strong>
                    </div>
                    <div className="driver-modal__card">
                      <span className="driver-modal__label">QR</span>
                      <strong>{selectedDriver.qrId ? `#${selectedDriver.qrId}` : "Not assigned"}</strong>
                    </div>
                    <div className="driver-modal__card">
                      <span className="driver-modal__label">Last Seen</span>
                      <strong>
                        {selectedDriver.liveState
                          ? formatLastSeen(selectedDriver.liveState.lastSeenTs, clockTs)
                          : "No live point yet"}
                      </strong>
                    </div>
                    <div className="driver-modal__card">
                      <span className="driver-modal__label">Current Point</span>
                      <strong>
                        {selectedDriver.liveState
                          ? formatPoint(selectedDriver.liveState.latestPoint)
                          : "Waiting for live GPS point"}
                      </strong>
                    </div>
                    <div className="driver-modal__card">
                      <span className="driver-modal__label">Created</span>
                      <strong>{formatDateTime(selectedDriver.createdAt)}</strong>
                    </div>
                  </section>

                  <section className="driver-modal__history">
                    <div className="driver-modal__section-head">
                      <h4>Trip History</h4>
                      <p>Showing recent trips available in the dashboard.</p>
                    </div>

                    {selectedDriverTripRows.length === 0 ? (
                      <div className="driver-modal__empty">
                        No trip history found for this driver yet.
                      </div>
                    ) : (
                      <div className="driver-trip-list">
                        {selectedDriverTripRows.map((trip) => (
                          <article key={trip.tripId} className="driver-trip-card">
                            <div className="driver-trip-card__top">
                              <div>
                                <strong>{trip.routeName}</strong>
                                <div className="driver-trip-card__meta">
                                  Trip #{trip.tripId} | {trip.plateNo} | {trip.todaName}
                                </div>
                              </div>
                              <span className={`driver-trip-card__status driver-trip-card__status--${trip.tripStatus}`}>
                                {formatTripStatus(trip.tripStatus)}
                              </span>
                            </div>
                            <div className="driver-trip-card__grid">
                              <div>
                                <span>Start</span>
                                <strong>{formatDateTime(trip.tripStart)}</strong>
                              </div>
                              <div>
                                <span>End</span>
                                <strong>{formatDateTime(trip.tripEnd)}</strong>
                              </div>
                              <div>
                                <span>Duration</span>
                                <strong>{trip.durationMinutes !== undefined ? `${trip.durationMinutes} min` : "-"}</strong>
                              </div>
                              <div>
                                <span>Fare</span>
                                <strong>{formatFareAmount(trip.fareAmount)}</strong>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>
          )}

          {profileModalOpen && (
            <div
              className="profile-settings-backdrop"
              role="presentation"
              onClick={() => setProfileModalOpen(false)}
            >
              <div
                className="profile-settings-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="profile-settings-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="profile-settings-modal__header">
                  <div className="profile-settings-modal__identity">
                    <div className="profile-settings-modal__avatar">{profileInitials}</div>
                    <div>
                      <h3 id="profile-settings-title">Admin Profile Settings</h3>
                      <p>{profileDisplayName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="profile-settings-modal__close"
                    onClick={() => setProfileModalOpen(false)}
                  >
                    Close
                  </button>
                </div>

                <form className="profile-settings-modal__form">
                  <label className="profile-settings-modal__field">
                    <span>Email Address</span>
                    <input type="email" value={adminProfile.email} readOnly />
                  </label>

                  <label className="profile-settings-modal__field">
                    <span>Role</span>
                    <input type="text" value={profileScope} readOnly />
                  </label>

                  <label className="profile-settings-modal__field">
                    <span>Status</span>
                    <input
                      type="text"
                      value={adminProfile.status.charAt(0).toUpperCase() + adminProfile.status.slice(1)}
                      readOnly
                    />
                  </label>

                  <label className="profile-settings-modal__field">
                    <span>Barangay</span>
                    <input type="text" value={adminProfile.barangayName ?? "All barangays"} readOnly />
                  </label>

                  <label className="profile-settings-modal__field">
                    <span>TODA</span>
                    <input type="text" value={adminProfile.todaName ?? "All TODAs"} readOnly />
                  </label>

                  <label className="profile-settings-modal__field">
                    <span>City</span>
                    <input type="text" value={adminProfile.city ?? "Not assigned"} readOnly />
                  </label>

                  <label className="profile-settings-modal__field">
                    <span>Admin ID</span>
                    <input type="text" value={`ADM-${String(adminProfile.adminId).padStart(3, "0")}`} readOnly />
                  </label>

                  <label className="profile-settings-modal__field profile-settings-modal__field--wide">
                    <span>Account Note</span>
                    <textarea
                      rows={3}
                      value="Profile updates are currently managed through the centralized admin account records."
                      readOnly
                    />
                  </label>
                </form>

                <div className="profile-settings-modal__footer">
                  <button
                    type="button"
                    className="profile-settings-modal__secondary"
                    onClick={() => setProfileModalOpen(false)}
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    className="profile-settings-modal__danger"
                    onClick={onLogout}
                  >
                    Log out
                  </button>
                </div>
              </div>
            </div>
          )}

          {activePage === "tricycles" && adminProfile.role === "toda_admin" && (
            <TodaManagementPage
              accessToken={accessToken}
              page="tricycles"
              lockedTodaId={adminProfile.todaId}
              lockedTodaLabel={adminProfile.todaName}
              onDataChanged={() => void refreshDashboardData()}
            />
          )}

          {activePage === "alerts" && (
            <section className="page-panel page-stack">
              <div className="page-panel__header">
                <h2>Alerts</h2>
                <p>
                  {hasSearchQuery
                    ? `${filteredAlerts.length} matches for "${trimmedSearchQuery}"`
                    : `${alertRows.length} total violations flagged`}
                </p>
              </div>
              <div className="alerts-list alerts-list--page">
                {filteredAlerts.length === 0 ? (
                  <div className="muted">
                    {hasSearchQuery
                      ? `No alerts match "${trimmedSearchQuery}".`
                      : "No geofence boundary alerts yet."}
                  </div>
                ) : (
                  filteredAlerts.map((alert) => (
                    <div key={alert.key} className="alert-row">
                      <div className="alert-row__top">
                        <strong>{alert.driverName ?? `Driver ${alert.driverId}`}</strong>
                        <span>{new Date(alert.ts).toLocaleString()}</span>
                      </div>
                      <div className="alert-row__meta">{alert.reason}</div>
                      {alert.description && (
                        <div className="alert-row__meta">{alert.description}</div>
                      )}
                      {alert.lat !== undefined && alert.lng !== undefined && (
                        <div className="alert-row__meta">
                          {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}
                        </div>
                      )}
                      {(alert.todaName || alert.barangayName || alert.status) && (
                        <div className="alert-row__meta">
                          {[alert.barangayName, alert.todaName, alert.status]
                            .filter(Boolean)
                            .join(" | ")}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {activePage === "reports" && (
            <ReportsPage
              accessToken={accessToken}
              onDataChanged={() => void refreshDashboardData()}
            />
          )}

          {activePage === "trip-logs" && (
            <section className="page-panel page-stack">
              <div className="page-panel__header">
                <h2>Trip Logs</h2>
                <p>
                  {hasSearchQuery
                    ? `${filteredTripRows.length} matches for "${trimmedSearchQuery}"`
                    : `${pageLabel} monitoring stream`}
                </p>
              </div>
              <div className="trip-logs-list trip-logs-list--page">
                {filteredTripRows.length === 0 ? (
                  <div className="muted">
                    {hasSearchQuery
                      ? `No trip logs match "${trimmedSearchQuery}".`
                      : "No stored trips yet."}
                  </div>
                ) : (
                  filteredTripRows.map((trip) => (
                    <div key={trip.tripId} className="trip-driver">
                      <div className="trip-driver__top">
                        <strong>{trip.driverName}</strong>
                        <span>{trip.tripStatus.toUpperCase()}</span>
                      </div>
                      <div className="trip-driver__meta">
                        Trip #{trip.tripId} | {trip.plateNo} | {trip.routeName}
                      </div>
                      <div className="trip-points">
                        <div className="trip-point">
                          <span>Start</span>
                          <span>{new Date(trip.tripStart).toLocaleString()}</span>
                        </div>
                        <div className="trip-point">
                          <span>End</span>
                          <span>{trip.tripEnd ? new Date(trip.tripEnd).toLocaleString() : "-"}</span>
                        </div>
                        <div className="trip-point">
                          <span>Fare</span>
                          <span>{trip.fareAmount !== undefined ? `PHP ${trip.fareAmount.toFixed(2)}` : "-"}</span>
                        </div>
                        <div className="trip-point">
                          <span>Duration</span>
                          <span>{trip.durationMinutes !== undefined ? `${trip.durationMinutes} min` : "-"}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
