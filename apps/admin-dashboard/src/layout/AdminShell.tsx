import { useEffect, useMemo, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import * as turf from "@turf/turf"
import type { GeoJSON as MapGeoJSON } from "../types/geojson"
import type { DriverLocationEvent } from "../lib/shared-types"
import type { AdminProfile } from "../lib/admin-profile"
import { markAdminAppealViewed } from "../lib/reports"
import {
  fetchDashboardData,
  getCachedDashboardData,
  getCachedTripPath,
  type DashboardDataSnapshot,
  type DashboardDriverRecord,
  type DashboardEmergencyRecord,
  type DashboardOperationalDriverRecord,
  type DashboardTripRecord,
  type DashboardViolationRecord,
  type DriverPasswordResetRequestRecord,
  type TripPathRecord,
  fetchTripPath,
  markDashboardNotificationsRead,
  updateViolationAlertStatus,
  decideDriverPasswordResetRequest
} from "../lib/dashboard-data"
import {
  connectAdminEmergencyStream,
  updateEmergencyAlertStatus
} from "../lib/emergencies"
import geofenceRaw from "../data/geofence.geojson?raw"
import { supabase } from "../lib/supabase"
import ReportsPage from "../components/ReportsPage"
import ViolatorProfileStack from "../components/live-map/ViolatorProfileStack"
import ViolationPopup from "../components/live-map/ViolationPopup"
import {
  getViolatorTimestampMs,
  sortViolatorsByRecency,
  type LiveMapViolator,
  type ViolationPopupPosition
} from "../components/live-map/violator-types"
import {
  createSmoothDriverMarkerManager,
  type DriverMarkerAppearance,
  type DriverMarkerOnlineStatus
} from "../components/live-map/smooth-driver-markers"
import SuperadminPage from "../superadmin/SuperadminPage"
import TodaManagementPage from "../toda/TodaManagementPage"
import {
  createRasterStyle,
  type TriketrackMapStyleId
} from "../lib/map-basemaps"
import "./AdminShell.css"

type DriverStreamState = {
  driverId: string
  lastSeenTs: number
  latestPoint: DriverLocationEvent
  violationCount: number
  recentPoints: DriverLocationEvent[]
  onlineStatus: DriverMarkerOnlineStatus
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

const renderNavIcon = (key: NavKey) => {
  const commonProps = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  }

  switch (key) {
    case "home":
      return (
        <svg {...commonProps}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5.5 9.5V20h13V9.5" />
          <path d="M9.5 20v-6h5v6" />
        </svg>
      )
    case "live-map":
      return (
        <svg {...commonProps}>
          <path d="M9 18 3.8 20.2V6L9 3.8l6 2.4 5.2-2.4v14.2L15 20.2z" />
          <path d="M9 3.8v14.2" />
          <path d="M15 6.2v14" />
        </svg>
      )
    case "drivers":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 19.5c1.7-3 4-4.5 6.5-4.5s4.8 1.5 6.5 4.5" />
        </svg>
      )
    case "tricycles":
      return (
        <svg {...commonProps}>
          <circle cx="7.5" cy="17" r="2" />
          <circle cx="17.5" cy="17" r="2" />
          <path d="M5.5 17H4l1.8-6h6.6l2.5 6H14" />
          <path d="M10 11V8h3.2l2.8 3" />
        </svg>
      )
    case "alerts":
      return (
        <svg {...commonProps}>
          <path d="M12 4a4 4 0 0 0-4 4v2.2c0 .7-.2 1.4-.6 2L6 14.5h12l-1.4-2.3c-.4-.6-.6-1.3-.6-2V8a4 4 0 0 0-4-4Z" />
          <path d="M10 18a2.2 2.2 0 0 0 4 0" />
        </svg>
      )
    case "reports":
      return (
        <svg {...commonProps}>
          <path d="M7 3.5h7l4 4V20H7z" />
          <path d="M14 3.5V8h4" />
          <path d="M10 12h5" />
          <path d="M10 16h5" />
        </svg>
      )
    case "trip-logs":
      return (
        <svg {...commonProps}>
          <path d="M7 5.5h10" />
          <path d="M7 12h10" />
          <path d="M7 18.5h10" />
          <path d="M4.5 5.5h.01" />
          <path d="M4.5 12h.01" />
          <path d="M4.5 18.5h.01" />
        </svg>
      )
    case "superadmin":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="m19 12-.7-.4a7.7 7.7 0 0 0-.2-1.1l.5-.7-1.6-2.7-.8.2a7.8 7.8 0 0 0-.9-.7L14.8 4h-3.6l-.4.8a7.8 7.8 0 0 0-.9.7l-.8-.2-1.6 2.7.5.7a7.7 7.7 0 0 0-.2 1.1L5 12l.7.4c0 .4.1.8.2 1.1l-.5.7 1.6 2.7.8-.2c.3.3.6.5.9.7l.4.8h3.6l.4-.8c.3-.2.6-.4.9-.7l.8.2 1.6-2.7-.5-.7c.1-.3.2-.7.2-1.1Z" />
        </svg>
      )
    case "toda-admin":
      return (
        <svg {...commonProps}>
          <path d="M4 7.5h16" />
          <path d="M6 4.5h12V19.5H6z" />
          <path d="M9 11h6" />
          <path d="M9 14.5h4" />
        </svg>
      )
  }
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

const PAGE_SEARCH_PLACEHOLDERS: Record<NavKey, string> = {
  home: "Search drivers, alerts, trips...",
  "live-map": "Search driver ID, route, GPS point...",
  drivers: "Search driver ID, name, tricycle, QR...",
  tricycles: "Search tricycle ID, plate, registration...",
  alerts: "Search driver ID, violation, plate, route...",
  reports: "Search report ID, driver, route, plate...",
  "trip-logs": "Search trip ID, driver ID, plate, route...",
  superadmin: "Search admins, barangays, TODAs, routes...",
  "toda-admin": "Search driver ID, tricycle ID, plate..."
}

const RECENT_POINTS_PER_DRIVER = 8
const OBRERO_CENTER: [number, number] = [125.6128, 7.0848]
const DEFAULT_CITY_ZOOM = 11
const WORLD_MIN_ZOOM = 1
const GEOFENCE_FIT_PADDING = 28
const GEOFENCE_FOCUS_MAX_ZOOM = 13.5
const HOME_ALERT_SUMMARY_LIMIT = 5
const HOME_TRIP_LOG_SUMMARY_LIMIT = 6
const NOTIFICATION_TRIP_WINDOW_MS = 24 * 60 * 60 * 1000
const NOTIFICATION_DRIVER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const NOTIFICATION_LIMIT = 12
const DRIVER_PRESENCE_STALE_MS = 2 * 60 * 1000

type NotificationCategoryFilter = "all" | NotificationItem["kind"]
type NotificationRecencyFilter = "all" | "24h" | "7d" | "30d"
type NotificationReadFilter = "all" | "unread" | "read"

const ALERT_REASON_PRIORITY: Record<string, number> = {
  EMERGENCY: 100,
  PANIC: 100,
  COLLISION: 95,
  SPEED: 80,
  OUTSIDE_ROUTE_CORRIDOR: 60
}

const FRESH_VIOLATION_WINDOW_MS = 30 * 60 * 1000
const VIOLATOR_DISMISSALS_STORAGE_KEY_PREFIX = "triketrack-admin-violator-dismissals"
const LIVE_VIOLATORS_STORAGE_KEY_PREFIX = "triketrack-admin-live-violators"
const ACTIVE_VIOLATION_STATUSES = new Set([
  "active",
  "unresolved",
  "pending",
  "open",
  "under_review"
])
const CLOSED_VIOLATION_STATUSES = new Set(["resolved", "dismissed", "cleared"])
const OUTSIDE_GEOFENCE_HINTS = [
  "outside_geofence",
  "geofence_exit",
  "geofence",
  "outside geofence",
  "outside route corridor",
  "geofence deviation"
]

const formatLastSeen = (lastSeenTs: number, nowTs: number) => {
  const diffSeconds = Math.max(0, Math.floor((nowTs - lastSeenTs) / 1000))
  if (diffSeconds < 60) return `${diffSeconds}s ago`
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  return `${diffHours}h ago`
}

const formatPoint = (_point: DriverLocationEvent) => "Location captured"

const textMatchesSearch = (
  normalizedSearchQuery: string,
  ...values: Array<string | number | boolean | undefined | null>
) =>
  values.some(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).toLowerCase().includes(normalizedSearchQuery)
  )

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

const isFreshPresence = (lastSeenTs: number, nowTs: number) =>
  nowTs - lastSeenTs <= DRIVER_PRESENCE_STALE_MS

const getGeofenceBounds = (
  geofenceFeature: MapGeoJSON["features"][number]
): [[number, number], [number, number]] => {
  const [minLng, minLat, maxLng, maxLat] = turf.bbox(geofenceFeature)
  return [
    [minLng, minLat],
    [maxLng, maxLat]
  ]
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

const formatTripStatus = (value: DashboardTripRecord["tripStatus"]) =>
  value.charAt(0).toUpperCase() + value.slice(1)

type TripDisplayStatus = "ongoing" | "completed" | "incomplete" | "cancelled"

const formatTripDisplayStatus = (value: TripDisplayStatus) =>
  value.charAt(0).toUpperCase() + value.slice(1)

const COORDINATE_TEXT_PATTERN =
  /(?:Coordinates:\s*)?-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?\.?/gi

const isCoordinateText = (value?: string | null) =>
  Boolean(value?.trim().match(/^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/))

const removeCoordinateText = (value?: string | null) =>
  value
    ?.replace(COORDINATE_TEXT_PATTERN, "")
    .replace(/\s+\|\s+\|/g, " | ")
    .replace(/^\s*\|\s*|\s*\|\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()

const getReadableLocationLabel = (
  label?: string | null,
  fallback = "Location name unavailable"
) => {
  const cleaned = removeCoordinateText(label)
  return cleaned && !isCoordinateText(cleaned) ? cleaned : fallback
}

const getTripLocationName = (label?: string | null, fallback = "Location name unavailable") =>
  getReadableLocationLabel(label, fallback)

const createViolationMarkerElement = () => {
  const markerEl = document.createElement("div")
  markerEl.className = "violation-map-focus-marker"
  markerEl.setAttribute("aria-label", "Outside geofence violation")
  markerEl.innerHTML = `
    <span class="violation-map-focus-marker__pulse" aria-hidden="true"></span>
    <span class="violation-map-focus-marker__core" aria-hidden="true">!</span>
  `
  return markerEl
}

const isLngLatPair = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === "number" &&
  Number.isFinite(value[0]) &&
  typeof value[1] === "number" &&
  Number.isFinite(value[1])

const getTripPathCoordinates = (pathGeojson: unknown): Array<[number, number]> => {
  if (!pathGeojson || typeof pathGeojson !== "object") return []
  const candidate = pathGeojson as Record<string, unknown>
  const geometry =
    candidate.type === "Feature" && candidate.geometry && typeof candidate.geometry === "object"
      ? (candidate.geometry as Record<string, unknown>)
      : candidate

  if (geometry?.type !== "LineString" || !Array.isArray(geometry.coordinates)) {
    return []
  }

  return geometry.coordinates.filter(isLngLatPair)
}

function TripPathMap({
  tripPath,
  violations = []
}: {
  tripPath: TripPathRecord
  violations?: DashboardViolationRecord[]
}) {
  const mapRootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!mapRootRef.current) return

    const coordinates = getTripPathCoordinates(tripPath.pathGeojson)
    const violationCoordinates = violations.filter(
      (violation): violation is DashboardViolationRecord & { latitude: number; longitude: number } =>
        typeof violation.latitude === "number" &&
        Number.isFinite(violation.latitude) &&
        typeof violation.longitude === "number" &&
        Number.isFinite(violation.longitude)
    )
    const map = new maplibregl.Map({
      container: mapRootRef.current,
      style: createRasterStyle("street") as maplibregl.StyleSpecification,
      center: coordinates[0] ?? OBRERO_CENTER,
      zoom: coordinates.length > 0 ? 14 : DEFAULT_CITY_ZOOM,
      minZoom: WORLD_MIN_ZOOM,
      maxZoom: 19
    })

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        visualizePitch: false
      }),
      "top-right"
    )

    map.on("load", () => {
      if (coordinates.length < 2) return

      const lineFeature = {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates
        },
        properties: {}
      }

      map.addSource("trip-path", {
        type: "geojson",
        data: lineFeature as any
      })
      map.addLayer({
        id: "trip-path-line",
        type: "line",
        source: "trip-path",
        paint: {
          "line-color": "#2563eb",
          "line-width": 5,
          "line-opacity": 0.9
        }
      })

      map.addLayer({
        id: "trip-path-trace-line",
        type: "line",
        source: "trip-path",
        paint: {
          "line-color": "#0f172a",
          "line-width": 2,
          "line-opacity": 0.45,
          "line-dasharray": [1, 1.5]
        }
      })

      const bounds = new maplibregl.LngLatBounds()
      for (const coordinate of coordinates) {
        bounds.extend(coordinate)
      }
      for (const violation of violationCoordinates) {
        bounds.extend([violation.longitude, violation.latitude])
      }
      map.fitBounds(bounds, {
        padding: 54,
        maxZoom: 16,
        duration: 0
      })

      const [startPoint] = coordinates
      const endPoint = coordinates[coordinates.length - 1]
      if (startPoint) {
        new maplibregl.Marker({ color: "#16a34a" })
          .setLngLat(startPoint)
          .setPopup(new maplibregl.Popup({ offset: 12 }).setText("Trip start"))
          .addTo(map)
      }
      if (endPoint) {
        new maplibregl.Marker({ color: "#dc2626" })
          .setLngLat(endPoint)
          .setPopup(new maplibregl.Popup({ offset: 12 }).setText("Latest/end point"))
          .addTo(map)
      }

      for (const violation of violationCoordinates) {
        const markerEl = createViolationMarkerElement()
        markerEl.setAttribute("aria-label", violation.violationTypeLabel)
        new maplibregl.Marker({ element: markerEl })
          .setLngLat([violation.longitude, violation.latitude])
          .setPopup(
            new maplibregl.Popup({ offset: 12 }).setText(
              `${violation.violationTypeLabel} | ${formatDateTime(violation.detectedAt)}`
            )
          )
          .addTo(map)
      }
    })

    return () => {
      map.remove()
    }
  }, [tripPath, violations])

  return <div className="trip-path-map" ref={mapRootRef} />
}

const hasViolationCoordinates = (
  alert: Pick<ViolationAlertDetails, "lat" | "lng">
): alert is Pick<ViolationAlertDetails, "lat" | "lng"> & { lat: number; lng: number } =>
  typeof alert.lat === "number" &&
  Number.isFinite(alert.lat) &&
  typeof alert.lng === "number" &&
  Number.isFinite(alert.lng)

const normalizeDriverToken = (value?: string | number | null) => {
  if (value === undefined || value === null) return null
  const normalized = String(value).trim().toUpperCase()
  return normalized.length > 0 ? normalized : null
}

const getViolatorDriverKey = ({
  driverCode,
  driverId
}: {
  driverCode?: string | null
  driverId?: string | number | null
}) => {
  const normalizedCode = normalizeDriverToken(driverCode)
  if (normalizedCode) return `code:${normalizedCode}`
  const normalizedId = normalizeDriverToken(driverId)
  return normalizedId ? `id:${normalizedId}` : null
}

const buildDriverTokens = (...values: Array<string | number | null | undefined>) =>
  [...new Set(values.map((value) => normalizeDriverToken(value)).filter(Boolean))] as string[]

const getViolatorTrackingIdentifiers = (violator: LiveMapViolator) => {
  const driverTokens = (violator as LiveMapViolator & { driverTokens?: string[] }).driverTokens
  return driverTokens && driverTokens.length > 0 ? driverTokens : [violator.driverId]
}

const hasVisibleDriverTokenMatch = (
  violator: Pick<MapViolatorRecord, "driverTokens">,
  visibleIdentifiers: Set<string>
) => violator.driverTokens.some((token) => visibleIdentifiers.has(token))

const isOutsideGeofenceViolation = (violation: DashboardViolationRecord) => {
  const haystack = [
    violation.violationTypeCode,
    violation.violationTypeLabel,
    violation.description
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return OUTSIDE_GEOFENCE_HINTS.some((hint) => haystack.includes(hint))
}

const isGeofenceBoundaryViolation = (violation: DashboardViolationRecord) => {
  const haystack = [
    violation.violationTypeCode,
    violation.violationTypeLabel,
    violation.description
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return haystack.includes("geofence") || haystack.includes("boundary")
}

const formatAlertStatusLabel = (status?: string) => {
  switch (status) {
    case "open":
      return "Take Action"
    case "under_review":
      return "Under Review"
    case "resolved":
      return "Resolved"
    default:
      return status ? status.replace(/_/g, " ") : "Take Action"
  }
}

const formatEmergencyStatusLabel = (status?: string) => {
  switch (status) {
    case "responding":
      return "Taking Action"
    case "pending_admin":
      return "Pending Admin"
    case "acknowledged":
      return "Acknowledged"
    case "resolved":
      return "Resolved"
    default:
      return status ? status.replace(/_/g, " ") : "Unknown"
  }
}

const isSameLocalCalendarDay = (leftTs: number, rightTs: number) => {
  const left = new Date(leftTs)
  const right = new Date(rightTs)
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

const isViolatorActive = (violator: Pick<MapViolatorRecord, "status" | "resolvedAt">) => {
  const normalizedStatus = violator.status.trim().toLowerCase()
  if (CLOSED_VIOLATION_STATUSES.has(normalizedStatus)) return false
  if (!ACTIVE_VIOLATION_STATUSES.has(normalizedStatus)) return false
  return !violator.resolvedAt
}

const qualifiesForFreshViolatorStack = (
  timestamp: string,
  nowTs: number,
  hasAnyTodayViolation: boolean
) => {
  const violationTs = new Date(timestamp).getTime()
  if (!Number.isFinite(violationTs)) return false
  if (isSameLocalCalendarDay(violationTs, nowTs)) return true
  if (hasAnyTodayViolation) return false
  return Math.max(0, nowTs - violationTs) <= FRESH_VIOLATION_WINDOW_MS
}

const getViolatorDismissalKey = (violator: Pick<LiveMapViolator, "source" | "violationId">) =>
  `${violator.source}:${violator.violationId}`

type AdminShellProps = {
  onLogout: () => void
  adminProfile: AdminProfile
  accessToken: string
  offlineViewerMode?: boolean
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

type DriverDirectoryRow = DashboardDriverRecord & {
  liveState?: DriverStreamState
  operationalState?: DashboardOperationalDriverRecord
}

type MapViolatorRecord = LiveMapViolator & {
  driverTokens: string[]
}

type DismissedViolatorRecord = {
  dismissalKey: string
  dismissedAt: number
}

const isDriverOnlineNow = (
  driver: DriverDirectoryRow,
  nowTs: number,
  livePresenceHydrated: boolean
) => {
  if (driver.status !== "active") return false

  if (livePresenceHydrated) {
    return Boolean(
      driver.liveState &&
        driver.liveState.onlineStatus === "online" &&
        isFreshPresence(driver.liveState.lastSeenTs, nowTs)
    )
  }

  return (
    driver.liveState?.onlineStatus === "online" || driver.operationalState?.isOnline === true
  )
}

const getDriverPresenceMeta = (
  driver: DriverDirectoryRow,
  nowTs: number,
  livePresenceHydrated: boolean
) => {
  if (driver.status === "suspended") {
    return { label: "Suspended", className: "status-badge offline" }
  }
  if (driver.status === "inactive") {
    return { label: "Inactive", className: "status-badge offline" }
  }
  if (
    driver.operationalState?.operationalStatus === "on_trip" &&
    isDriverOnlineNow(driver, nowTs, livePresenceHydrated)
  ) {
    return { label: "On Trip", className: "status-badge online" }
  }
  if (isDriverOnlineNow(driver, nowTs, livePresenceHydrated)) {
    return { label: "Online", className: "status-badge online" }
  }

  return {
    label: "Offline",
    className: "status-badge offline"
  }
}

const driverMatchesSearch = (
  driver: DriverDirectoryRow,
  normalizedSearchQuery: string
) => {
  const latestPoint = driver.liveState?.latestPoint
  const presenceLabel = getDriverPresenceMeta(driver, Date.now(), true).label

  return textMatchesSearch(
    normalizedSearchQuery,
    driver.driverId,
    driver.driverCode,
    `${driver.firstName} ${driver.lastName}`,
    driver.firstName,
    driver.lastName,
    driver.contactNo,
    driver.tricycleId,
    driver.tricycleNo,
    driver.qrId,
    driver.todaId,
    driver.todaName,
    driver.barangayId,
    driver.barangayName,
    driver.status,
    driver.passwordSet ? "password set" : "password pending",
    presenceLabel,
    latestPoint?.tripId,
    latestPoint ? formatPoint(latestPoint) : undefined,
    driver.operationalState?.activeTripId,
    driver.operationalState?.activeRouteId,
    driver.operationalState?.activeRouteName,
    driver.operationalState?.operationalStatus
  )
}

type AlertListItem = {
  key: string
  source: "violation" | "emergency"
  emergencyId?: number
  violationId?: DashboardViolationRecord["violationId"]
  alertSource?: DashboardViolationRecord["alertSource"]
  driverId: string
  driverName?: string
  todaName?: string
  barangayName?: string
  plateNo?: string
  routeName?: string
  ts: number
  reason: string
  description?: string
  status?: string
  lat?: number
  lng?: number
}

type SelectedAlertDetails =
  | { kind: "violation"; item: AlertListItem; record: DashboardViolationRecord }
  | { kind: "emergency"; item: AlertListItem; record: DashboardEmergencyRecord }

type ViolationAlertDetails = {
  key: string
  source: "live_geofence" | DashboardViolationRecord["alertSource"] | "passenger_emergency"
  driverId?: number
  driverCode?: string
  driverName?: string
  profileImageUrl?: string
  plateNo?: string
  tricycleNo?: string
  tricycleId?: number
  tripId?: string | number
  routeName?: string
  violationType: string
  timestamp: string
  locationLabel?: string
  description?: string
  lat?: number
  lng?: number
}

type NotificationItem = {
  key: string
  kind: "violation" | "trip" | "driver" | "emergency" | "appeal" | "password_reset"
  page: Extract<NavKey, "alerts" | "trip-logs" | "drivers" | "reports">
  title: string
  body: string
  ts: number
  priority: number
  tone: "danger" | "warn" | "info"
  sourceEntityId: string
  isRead: boolean
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
    tone: "danger",
    sourceEntityId: String(alert.key),
    isRead: false
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
    tone: trip.tripStatus === "cancelled" ? "warn" : "info",
    sourceEntityId: String(trip.tripId),
    isRead: false
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
    tone: reason === "suspended" ? "danger" : "warn",
    sourceEntityId: String(driver.driverId),
    isRead: false
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

const createStoredAlertListItem = (alert: DashboardViolationRecord): AlertListItem => ({
  key: `stored-${alert.alertSource}-${alert.violationId}`,
  source: "violation",
  violationId: alert.violationId,
  alertSource: alert.alertSource,
  driverId: String(alert.driverId ?? "N/A"),
  driverName: alert.driverName ?? alert.driverCode,
  todaName: alert.todaName,
  barangayName: alert.barangayName,
  plateNo: alert.plateNo,
  routeName: alert.routeName,
  ts: new Date(alert.detectedAt).getTime(),
  reason: alert.violationTypeLabel,
  description: [
    getReadableLocationLabel(alert.locationLabel, ""),
    removeCoordinateText(alert.description)
  ]
    .filter(Boolean)
    .join(" | "),
  status: alert.status,
  lat: alert.latitude,
  lng: alert.longitude
})

const createStoredEmergencyAlertListItem = (
  alert: DashboardEmergencyRecord
): AlertListItem => ({
  key: `emergency-${alert.emergencyId}`,
  source: "emergency",
  emergencyId: alert.emergencyId,
  driverId: String(alert.driverId),
  driverName: alert.driverName,
  todaName: alert.todaName,
  barangayName: alert.barangayName,
  plateNo: alert.plateNo,
  routeName: alert.routeName,
  ts: new Date(alert.updatedAt).getTime(),
  reason: "Passenger Emergency",
  description: [
    "Passenger triggered the emergency action from the QR web form.",
    getReadableLocationLabel(
      alert.passengerLocationName ?? alert.passenger_location_name ?? alert.locationLabel,
      ""
    ),
    alert.routeName
  ]
    .filter(Boolean)
    .join(" | "),
  status: alert.status,
  lat: alert.passengerLatitude ?? alert.passenger_latitude ?? alert.latitude,
  lng: alert.passengerLongitude ?? alert.passenger_longitude ?? alert.longitude
})

const getEmergencyAlertLocation = (
  alert: Pick<
    DashboardEmergencyRecord,
    | "passengerLatitude"
    | "passengerLongitude"
    | "passenger_latitude"
    | "passenger_longitude"
    | "latitude"
    | "longitude"
  >
) => {
  const latitude = alert.passengerLatitude ?? alert.passenger_latitude ?? alert.latitude
  const longitude = alert.passengerLongitude ?? alert.passenger_longitude ?? alert.longitude

  if (typeof latitude === "number" && typeof longitude === "number") {
    return { latitude, longitude }
  }

  return null
}

const getEmergencyLocationName = (
  alert: Pick<
    DashboardEmergencyRecord,
    "passengerLocationName" | "passenger_location_name" | "locationLabel"
  >
) =>
  getReadableLocationLabel(
    alert.passengerLocationName ?? alert.passenger_location_name ?? alert.locationLabel,
    "Passenger location name unavailable"
  )

const getStoredViolationKey = (
  alertSource: DashboardViolationRecord["alertSource"],
  violationId: DashboardViolationRecord["violationId"]
) => `${alertSource}:${violationId}`

void NOTIFICATION_TRIP_WINDOW_MS
void NOTIFICATION_DRIVER_WINDOW_MS
void NOTIFICATION_LIMIT
void createViolationNotification
void createTripNotification
void createDriverNotification

export default function AdminShell({
  onLogout,
  adminProfile,
  accessToken,
  offlineViewerMode = false
}: AdminShellProps) {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const driverMarkerManagerRef = useRef<ReturnType<
    typeof createSmoothDriverMarkerManager
  > | null>(null)
  const geofenceBoundsRef = useRef<[[number, number], [number, number]] | null>(null)
  const ensureGeofenceLayersRef = useRef<((fitToBounds?: boolean) => void) | null>(null)
  const appliedMapStyleRef = useRef<TriketrackMapStyleId>("street")
  const violationFocusMarkerRef = useRef<maplibregl.Marker | null>(null)
  const [activePage, setActivePage] = useState<NavKey>(
    adminProfile.role === "superadmin"
      ? "superadmin"
      : "home"
  )
  const [selectedMapStyle] = useState<TriketrackMapStyleId>("street")

  const [syncStatus, setSyncStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting")
  const [lastUpdateTs, setLastUpdateTs] = useState<number | null>(null)
  const [online, setOnline] = useState<boolean>(navigator.onLine && !offlineViewerMode)
  const [driversById, setDriversById] = useState<Record<string, DriverStreamState>>(
    {}
  )
  const driversByIdRef = useRef<Record<string, DriverStreamState>>({})
  const [dashboardData, setDashboardData] = useState<DashboardDataSnapshot | null>(null)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [dashboardNotice, setDashboardNotice] = useState<string | null>(null)
  const [lastDashboardSyncAt, setLastDashboardSyncAt] = useState<string | null>(null)
  const [dashboardDataSource, setDashboardDataSource] = useState<
    "live" | "cache" | "none"
  >("none")
  const [clockTs, setClockTs] = useState<number>(Date.now())
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [childSearchPlaceholder, setChildSearchPlaceholder] = useState<string | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [isRefreshingNotifications, setIsRefreshingNotifications] = useState(false)
  const [notificationCategoryFilter, setNotificationCategoryFilter] =
    useState<NotificationCategoryFilter>("all")
  const [notificationRecencyFilter, setNotificationRecencyFilter] =
    useState<NotificationRecencyFilter>("all")
  const [notificationReadFilter, setNotificationReadFilter] =
    useState<NotificationReadFilter>("all")
  const [notificationDateFrom, setNotificationDateFrom] = useState("")
  const [notificationDateTo, setNotificationDateTo] = useState("")
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [reportsPageSection] = useState<"reports" | "appeals">("reports")
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null)
  const [driverTripHistoryOpen, setDriverTripHistoryOpen] = useState(false)
  const [passwordResetBusyId, setPasswordResetBusyId] = useState<number | null>(null)
  const [passwordResetError, setPasswordResetError] = useState<string | null>(null)
  const [approvedTemporaryPassword, setApprovedTemporaryPassword] = useState<{
    requestId: number
    driverName: string
    temporaryPassword: string
    expiresAt?: string
    pushNotificationSent?: boolean
    pushNotificationError?: string
  } | null>(null)
  const [activePasswordResetRequest, setActivePasswordResetRequest] =
    useState<DriverPasswordResetRequestRecord | null>(null)
  const [selectedTripForPath, setSelectedTripForPath] =
    useState<DashboardTripRecord | null>(null)
  const [tripPathData, setTripPathData] = useState<TripPathRecord | null>(null)
  const [tripPathLoading, setTripPathLoading] = useState(false)
  const [tripPathError, setTripPathError] = useState<string | null>(null)
  const [livePresenceHydrated, setLivePresenceHydrated] = useState(false)
  const [activeEmergencyModal, setActiveEmergencyModal] =
    useState<DashboardEmergencyRecord | null>(null)
  const [emergencyQueue, setEmergencyQueue] = useState<DashboardEmergencyRecord[]>([])
  const [emergencyActionBusyId, setEmergencyActionBusyId] = useState<number | null>(null)
  const [selectedAlertDetails, setSelectedAlertDetails] =
    useState<SelectedAlertDetails | null>(null)
  const [alertStatusBusy, setAlertStatusBusy] = useState(false)

  const activeEmergencyLocation = activeEmergencyModal
    ? getEmergencyAlertLocation(activeEmergencyModal)
    : null

  const selectedAlertLocation = selectedAlertDetails
    ? getEmergencyAlertLocation(selectedAlertDetails.record)
    : null
  const [alertDetailsError, setAlertDetailsError] = useState<string | null>(null)
  const [activeViolationAlert, setActiveViolationAlert] =
    useState<ViolationAlertDetails | null>(null)
  const [violationAlertQueue, setViolationAlertQueue] = useState<ViolationAlertDetails[]>([])
  const [liveViolatorsByKey, setLiveViolatorsByKey] = useState<Record<string, MapViolatorRecord>>(
    {}
  )
  const [storedViolatorsByKey, setStoredViolatorsByKey] = useState<
    Record<string, MapViolatorRecord>
  >({})
  const [selectedViolatorKey, setSelectedViolatorKey] = useState<string | null>(null)
  const [selectedViolationPopupPosition, setSelectedViolationPopupPosition] =
    useState<ViolationPopupPosition | null>(null)
  const [dismissedViolatorsByDriver, setDismissedViolatorsByDriver] = useState<
    Record<string, DismissedViolatorRecord>
  >({})
  const dashboardDataRef = useRef<DashboardDataSnapshot | null>(null)
  const lastDashboardSyncAtRef = useRef<string | null>(null)
  const dashboardRefreshInFlightRef = useRef<Promise<void> | null>(null)
  const dashboardRefreshQueuedRef = useRef(false)
  const visibleDriverIdentifiersRef = useRef<Set<string>>(new Set())
  const dashboardDriversRef = useRef<DashboardDriverRecord[]>([])
  const shownPasswordResetRequestIdsRef = useRef<Set<number>>(new Set())
  const knownViolationKeysRef = useRef<Set<string>>(new Set())
  const pendingViolationPopupKeysRef = useRef<Set<string>>(new Set())
  const shownViolationPopupKeysRef = useRef<Set<string>>(new Set())
  const violationsHydratedRef = useRef(false)
  const driverInsideStateRef = useRef<Record<string, boolean>>({})
  const refreshLiveLocationsRef = useRef<(() => void) | null>(null)
  const notificationPanelRef = useRef<HTMLDivElement | null>(null)
  const trimmedSearchQuery = searchQuery.trim()
  const normalizedSearchQuery = trimmedSearchQuery.toLowerCase()
  const hasSearchQuery = normalizedSearchQuery.length > 0
  const showLiveMapView = activePage === "home" || activePage === "live-map"
  const showViolatorOverlay = activePage === "live-map"
  const violatorDismissalsStorageKey = `${VIOLATOR_DISMISSALS_STORAGE_KEY_PREFIX}:${adminProfile.adminId}`
  const liveViolatorsStorageKey = `${LIVE_VIOLATORS_STORAGE_KEY_PREFIX}:${adminProfile.adminId}`
  const activeViolators = useMemo<MapViolatorRecord[]>(() => {
    const newestByDriver = new Map<string, MapViolatorRecord>()
    const visibleIdentifiers = visibleDriverIdentifiersRef.current
    const candidates = [
      ...Object.values(liveViolatorsByKey),
      ...Object.values(storedViolatorsByKey)
    ].filter(
      (violator) =>
        isViolatorActive(violator) &&
        !violator.uiDismissedByAdmin &&
        hasVisibleDriverTokenMatch(violator, visibleIdentifiers)
    )

    for (const violator of candidates) {
      const existing = newestByDriver.get(violator.driverKey)
      if (!existing) {
        newestByDriver.set(violator.driverKey, violator)
        continue
      }

      const existingTs = getViolatorTimestampMs(existing)
      const incomingTs = getViolatorTimestampMs(violator)
      const latest = incomingTs >= existingTs ? violator : existing
      const fallback = latest === violator ? existing : violator

      newestByDriver.set(violator.driverKey, {
        ...fallback,
        ...latest,
        avatarUrl: latest.avatarUrl ?? fallback.avatarUrl ?? null,
        locationLabel: latest.locationLabel ?? fallback.locationLabel,
        driverTokens: [...new Set([...existing.driverTokens, ...violator.driverTokens])]
      })
    }

    return [...newestByDriver.values()]
      .filter((violator) => {
        const dismissed = dismissedViolatorsByDriver[violator.driverKey]
        return !dismissed || dismissed.dismissalKey !== getViolatorDismissalKey(violator)
      })
      .sort(sortViolatorsByRecency)
  }, [dashboardData?.drivers, dismissedViolatorsByDriver, liveViolatorsByKey, storedViolatorsByKey])

  const selectedViolator = useMemo(
    () => activeViolators.find((violator) => violator.driverKey === selectedViolatorKey) ?? null,
    [activeViolators, selectedViolatorKey]
  )

  const upsertStoredViolator = (violator: MapViolatorRecord) => {
    setStoredViolatorsByKey((current) => ({
      ...current,
      [violator.driverKey]: violator
    }))
  }

  const upsertLiveViolator = (violator: MapViolatorRecord) => {
    setLiveViolatorsByKey((current) => {
      const existing = current[violator.driverKey]
      if (
        existing &&
        existing.violationId === violator.violationId &&
        existing.latitude === violator.latitude &&
        existing.longitude === violator.longitude &&
        existing.timestamp === violator.timestamp
      ) {
        return current
      }

      return {
        ...current,
        [violator.driverKey]: violator
      }
    })
  }

  const updateViolatorsByTokens = (
    tokens: string[],
    updater: (violator: MapViolatorRecord) => MapViolatorRecord | null
  ) => {
    if (tokens.length === 0) return
    const tokenSet = new Set(tokens.map((token) => token.trim().toUpperCase()))

    const applyUpdate = (current: Record<string, MapViolatorRecord>) => {
      let changed = false
      const next: Record<string, MapViolatorRecord> = {}

      for (const [driverKey, violator] of Object.entries(current)) {
        const matches = violator.driverTokens.some((token) => tokenSet.has(token))
        if (!matches) {
          next[driverKey] = violator
          continue
        }

        const updated = updater(violator)
        if (!updated) {
          changed = true
          continue
        }

        changed = changed || updated !== violator
        next[driverKey] = updated
      }

      return changed ? next : current
    }

    setLiveViolatorsByKey(applyUpdate)
    setStoredViolatorsByKey(applyUpdate)
  }

  const dismissViolatorProfile = (violator: LiveMapViolator) => {
    const dismissalKey = getViolatorDismissalKey(violator)
    setDismissedViolatorsByDriver((current) => ({
      ...current,
      [violator.driverKey]: {
        dismissalKey,
        dismissedAt: Date.now()
      }
    }))

    const removeByDriverKey = (current: Record<string, MapViolatorRecord>) => {
      const next = { ...current }
      for (const [driverKey, item] of Object.entries(current)) {
        if (driverKey === violator.driverKey || item.driverKey === violator.driverKey) {
          delete next[driverKey]
        }
      }
      return next
    }

    setLiveViolatorsByKey(removeByDriverKey)
    setStoredViolatorsByKey(removeByDriverKey)

    if (selectedViolatorKey === violator.driverKey) {
      setSelectedViolatorKey(null)
      setSelectedViolationPopupPosition(null)
    }
  }

  const purgeViolatorProfilesByTokens = (tokens: string[]) => {
    if (tokens.length === 0) return

    const tokenSet = new Set(tokens.map((token) => token.trim().toUpperCase()))
    const selectedMatches =
      selectedViolator?.driverTokens?.some((token) => tokenSet.has(token)) ?? false

    updateViolatorsByTokens(tokens, () => null)

    setDismissedViolatorsByDriver((current) => {
      const next = { ...current }
      for (const driverKey of Object.keys(current)) {
        const normalizedDriverKey = driverKey.trim().toUpperCase()
        if (tokenSet.has(normalizedDriverKey.replace(/^CODE:/, "")) || tokenSet.has(normalizedDriverKey.replace(/^ID:/, ""))) {
          delete next[driverKey]
        }
      }
      return next
    })

    if (selectedMatches) {
      setSelectedViolatorKey(null)
      setSelectedViolationPopupPosition(null)
    }
  }

  const getDashboardDriverByIdentifier = (driverIdentifier: string | number) => {
    const normalizedIdentifier = String(driverIdentifier).trim().toUpperCase()
    return dashboardDataRef.current?.drivers.find((driver) => {
      return (
        String(driver.driverId) === String(driverIdentifier) ||
        driver.driverCode.trim().toUpperCase() === normalizedIdentifier
      )
    })
  }

  const getDashboardTripForViolation = (
    driverId?: number,
    tripId?: string | number
  ) => {
    const trips = dashboardDataRef.current?.recentTrips ?? []
    if (tripId !== undefined) {
      const normalizedTripId = String(tripId).replace(/^TRIP-/i, "")
      const byTripId = trips.find((trip) => String(trip.tripId) === normalizedTripId)
      if (byTripId) return byTripId
    }

    if (driverId === undefined) return undefined
    return trips.find((trip) => trip.driverId === driverId && trip.tripStatus === "ongoing")
  }

  const queueViolationAlert = (alert: ViolationAlertDetails) => {
    setActiveViolationAlert((current) => {
      if (!current) return alert
      if (current.key === alert.key) return current
      setViolationAlertQueue((queue) =>
        queue.some((item) => item.key === alert.key) ? queue : [...queue, alert]
      )
      return current
    })
  }

  const closeViolationAlert = () => {
    setActiveViolationAlert(null)
    setViolationAlertQueue((queue) => {
      const [next, ...rest] = queue
      if (next) {
        window.setTimeout(() => setActiveViolationAlert(next), 0)
      }
      return rest
    })
  }

  const focusViolationOnMap = (alert: ViolationAlertDetails) => {
    if (!hasViolationCoordinates(alert)) return
    closeViolationAlert()
    const driverLookupToken = alert.driverCode ?? alert.driverId
    const driverRecord = driverLookupToken
      ? getDashboardDriverByIdentifier(driverLookupToken)
      : undefined
    const liveState = driverRecord
      ? driversByIdRef.current[driverRecord.driverCode] ??
        driversByIdRef.current[String(driverRecord.driverId)]
      : undefined
    const driverKey =
      getViolatorDriverKey({
        driverCode: alert.driverCode,
        driverId: alert.driverId
      }) ?? `alert:${alert.key}`
    const nextViolator: MapViolatorRecord = {
      driverKey,
      driverId:
        normalizeDriverToken(alert.driverCode) ??
        (alert.driverId !== undefined ? String(alert.driverId) : "Unknown driver"),
      driverName: alert.driverName ?? alert.driverCode ?? "Unknown driver",
      avatarUrl: alert.profileImageUrl ?? null,
      latitude: alert.lat,
      longitude: alert.lng,
      violationType: "Outside geofence",
      timestamp: alert.timestamp,
      status: "active",
      violationId: alert.key,
      source: alert.source,
      locationLabel: alert.locationLabel,
      tripId: alert.tripId,
      routeName: alert.routeName,
      resolvedAt: null,
      driverOnlineStatus: liveState ? "online" : "offline",
      lastSeenTs: liveState?.lastSeenTs ?? null,
      uiDismissedByAdmin: false,
      driverTokens: buildDriverTokens(alert.driverCode, alert.driverId)
    }

    if (alert.source === "live_geofence") {
      upsertLiveViolator(nextViolator)
    } else {
      upsertStoredViolator(nextViolator)
    }

    setSelectedViolatorKey(driverKey)
    setActivePage("live-map")

    window.setTimeout(() => {
      const map = mapRef.current
      if (!map) return

      map.resize()
      map.flyTo({
        center: [nextViolator.longitude, nextViolator.latitude],
        zoom: Math.max(map.getZoom(), 16.2),
        essential: true
      })
    }, 80)
  }

  const refreshDashboardData = async () => {
    if (dashboardRefreshInFlightRef.current) {
      dashboardRefreshQueuedRef.current = true
      return dashboardRefreshInFlightRef.current
    }

    const runRefresh = async () => {
      try {
        const snapshot = offlineViewerMode
          ? await getCachedDashboardData()
          : await fetchDashboardData(accessToken)
        if (!snapshot) {
          throw new Error("No cached dashboard data is available for offline viewer mode.")
        }
        setDashboardData(snapshot)
        const syncedAt = snapshot.cacheMeta?.savedAt ?? new Date().toISOString()
        setLastDashboardSyncAt(syncedAt)
        lastDashboardSyncAtRef.current = syncedAt
        setDashboardDataSource(snapshot.cacheMeta ? "cache" : "live")
        setDashboardNotice(null)
        setDashboardError(null)
      } catch (error) {
        if (dashboardDataRef.current) {
          setDashboardDataSource("cache")
          setDashboardNotice(null)
          setDashboardError(null)
        } else {
          setDashboardError(String(error))
        }
      } finally {
        dashboardRefreshInFlightRef.current = null
        if (dashboardRefreshQueuedRef.current) {
          dashboardRefreshQueuedRef.current = false
          void refreshDashboardData()
        }
      }
    }

    const pendingRefresh = runRefresh()
    dashboardRefreshInFlightRef.current = pendingRefresh
    return pendingRefresh
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
    setChildSearchPlaceholder(null)
  }, [activePage])

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const cachedSnapshot = await getCachedDashboardData()
        if (active && cachedSnapshot) {
          setDashboardData(cachedSnapshot)
          setDashboardNotice(null)
          setLastDashboardSyncAt(cachedSnapshot.cacheMeta?.savedAt ?? null)
          lastDashboardSyncAtRef.current = cachedSnapshot.cacheMeta?.savedAt ?? null
          setDashboardDataSource("cache")
        }

        const snapshot = offlineViewerMode
          ? await getCachedDashboardData()
          : await fetchDashboardData(accessToken)
        if (!snapshot) {
          throw new Error("No cached dashboard data is available for offline viewer mode.")
        }
        if (!active) return
        setDashboardData(snapshot)
        const syncedAt = snapshot.cacheMeta?.savedAt ?? new Date().toISOString()
        setLastDashboardSyncAt(syncedAt)
        lastDashboardSyncAtRef.current = syncedAt
        setDashboardDataSource(snapshot.cacheMeta ? "cache" : "live")
        setDashboardNotice(null)
        setDashboardError(null)
      } catch (error) {
        if (!active) return
        if (dashboardDataRef.current) {
          setDashboardDataSource("cache")
          setDashboardNotice(null)
          setDashboardError(null)
        } else {
          setDashboardError(String(error))
        }
      }
    })()

    return () => {
      active = false
      dashboardRefreshInFlightRef.current = null
      dashboardRefreshQueuedRef.current = false
    }
  }, [accessToken, offlineViewerMode])

  useEffect(() => {
    const refreshOnResume = () => {
      if (document.visibilityState === "hidden" || !navigator.onLine) return
      void refreshDashboardData()
      refreshLiveLocationsRef.current?.()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshOnResume()
      }
    }

    window.addEventListener("focus", refreshOnResume)
    window.addEventListener("pageshow", refreshOnResume)
    window.addEventListener("online", refreshOnResume)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", refreshOnResume)
      window.removeEventListener("pageshow", refreshOnResume)
      window.removeEventListener("online", refreshOnResume)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [accessToken])

  useEffect(() => {
    driversByIdRef.current = driversById
  }, [driversById])

  useEffect(() => {
    dashboardDataRef.current = dashboardData
  }, [dashboardData])

  useEffect(() => {
    if (!dashboardData || activePasswordResetRequest) return

    const newPendingRequest = (dashboardData.passwordResetRequests ?? [])
      .filter((request) => request.status === "pending")
      .sort(
        (a, b) =>
          new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
      )
      .find((request) => !shownPasswordResetRequestIdsRef.current.has(request.requestId))

    if (!newPendingRequest) return

    shownPasswordResetRequestIdsRef.current.add(newPendingRequest.requestId)
    setPasswordResetError(null)
    setApprovedTemporaryPassword(null)
    setActivePasswordResetRequest(newPendingRequest)
  }, [activePasswordResetRequest, dashboardData])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(liveViolatorsStorageKey)
      if (!raw) return

      const parsed = JSON.parse(raw) as Record<string, MapViolatorRecord>
      if (!parsed || typeof parsed !== "object") return

      const normalizedEntries = Object.entries(parsed).filter((entry) => {
        const [, violator] = entry
        return (
          violator &&
          typeof violator === "object" &&
          typeof violator.driverKey === "string" &&
          typeof violator.violationId === "string" &&
          typeof violator.timestamp === "string" &&
          typeof violator.latitude === "number" &&
          typeof violator.longitude === "number"
        )
      })

      if (normalizedEntries.length === 0) return

      setLiveViolatorsByKey(Object.fromEntries(normalizedEntries))
    } catch {
      // Ignore invalid cached live violator data.
    }
  }, [liveViolatorsStorageKey])

  useEffect(() => {
    window.localStorage.setItem(
      liveViolatorsStorageKey,
      JSON.stringify(liveViolatorsByKey)
    )
  }, [liveViolatorsByKey, liveViolatorsStorageKey])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(violatorDismissalsStorageKey)
      if (!raw) {
        setDismissedViolatorsByDriver({})
        return
      }

      const parsed = JSON.parse(raw) as Record<
        string,
        string | DismissedViolatorRecord
      >
      if (!parsed || typeof parsed !== "object") {
        setDismissedViolatorsByDriver({})
        return
      }

      const normalized: Record<string, DismissedViolatorRecord> = {}
      for (const [driverKey, value] of Object.entries(parsed)) {
        if (typeof value === "string") {
          normalized[driverKey] = {
            dismissalKey: value,
            dismissedAt: Date.now()
          }
          continue
        }

        if (
          value &&
          typeof value === "object" &&
          typeof value.dismissalKey === "string" &&
          typeof value.dismissedAt === "number"
        ) {
          normalized[driverKey] = value
        }
      }

      setDismissedViolatorsByDriver(normalized)
    } catch {
      setDismissedViolatorsByDriver({})
    }
  }, [violatorDismissalsStorageKey])

  useEffect(() => {
    window.localStorage.setItem(
      violatorDismissalsStorageKey,
      JSON.stringify(dismissedViolatorsByDriver)
    )
  }, [dismissedViolatorsByDriver, violatorDismissalsStorageKey])

  useEffect(() => {
    if (!dashboardData) return

    dashboardDriversRef.current = dashboardData?.drivers ?? []
    const identifiers = new Set<string>()
    for (const driver of dashboardData?.drivers ?? []) {
      identifiers.add(String(driver.driverId))
      identifiers.add(driver.driverCode.trim().toUpperCase())
    }
    visibleDriverIdentifiersRef.current = identifiers

    setLiveViolatorsByKey((current) => {
      const nextEntries = Object.entries(current).filter(([, violator]) =>
        hasVisibleDriverTokenMatch(violator, identifiers)
      )

      return nextEntries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(nextEntries)
    })

    setStoredViolatorsByKey((current) => {
      const nextEntries = Object.entries(current).filter(([, violator]) =>
        hasVisibleDriverTokenMatch(violator, identifiers)
      )

      return nextEntries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(nextEntries)
    })

    refreshLiveLocationsRef.current?.()
  }, [dashboardData])

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
    if (selectedDriverId === null) return

    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (driverTripHistoryOpen) {
          setDriverTripHistoryOpen(false)
          return
        }
        setSelectedDriverId(null)
        setDriverTripHistoryOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousBodyOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [driverTripHistoryOpen, selectedDriverId])

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
    if (!selectedTripForPath) {
      setTripPathData(null)
      setTripPathError(null)
      setTripPathLoading(false)
      return
    }

    let active = true
    setTripPathLoading(true)
    setTripPathError(null)
    setTripPathData(null)

    void (async () => {
      const cachedPath = await getCachedTripPath(selectedTripForPath.tripId)
      if (!active || !cachedPath) return
      setTripPathData(cachedPath)
      setTripPathError(
        cachedPath.cacheMeta
          ? `Offline-ready trip path loaded from ${formatDateTime(cachedPath.cacheMeta.savedAt)}.`
          : null
      )
      setTripPathLoading(false)
    })()

    if (offlineViewerMode) {
      return () => {
        active = false
      }
    }

    void fetchTripPath(accessToken, selectedTripForPath.tripId)
      .then((path) => {
        if (!active) return
        setTripPathData(path)
        setTripPathError(
          path?.cacheMeta
            ? `Showing cached trip path from ${formatDateTime(path.cacheMeta.savedAt)}.`
            : null
        )
      })
      .catch((error) => {
        if (active) setTripPathError(String(error))
      })
      .finally(() => {
        if (active) setTripPathLoading(false)
      })

    return () => {
      active = false
    }
  }, [accessToken, selectedTripForPath, offlineViewerMode])

  useEffect(() => {
    if (!mapEl.current) return

    setLivePresenceHydrated(false)
    const geofence = JSON.parse(geofenceRaw) as MapGeoJSON
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
    const geofenceBounds = getGeofenceBounds(geofencePolygon)

    const map = new maplibregl.Map({
      container: mapEl.current,
      style: createRasterStyle(selectedMapStyle) as maplibregl.StyleSpecification,
      center: OBRERO_CENTER,
      zoom: DEFAULT_CITY_ZOOM,
      minZoom: WORLD_MIN_ZOOM,
      maxZoom: 19,
      renderWorldCopies: true
    })
    mapRef.current = map
    appliedMapStyleRef.current = selectedMapStyle
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
    let dashboardEventChannel:
      | ReturnType<typeof supabase.channel>
      | null = null
    let active = true
    let onlineHandler: (() => void) | null = null
    let dashboardRefreshTimer: number | undefined
    let stalePresenceTimer: number | undefined

    let pendingGeofenceFit = false
    let geofenceRetryQueued = false
    const ensureGeofenceLayers = (fitToBounds = false) => {
      geofenceBoundsRef.current = geofenceBounds

      if (fitToBounds) {
        pendingGeofenceFit = true
      }

      if (!map.isStyleLoaded()) {
        if (!geofenceRetryQueued) {
          geofenceRetryQueued = true
          map.once("style.load", () => {
            geofenceRetryQueued = false
            ensureGeofenceLayers(false)
          })
        }
        return
      }

      const shouldFitToBounds = pendingGeofenceFit
      pendingGeofenceFit = false

      if (shouldFitToBounds) {
        map.fitBounds(geofenceBounds, {
          padding: GEOFENCE_FIT_PADDING,
          duration: 0,
          maxZoom: GEOFENCE_FOCUS_MAX_ZOOM
        })
      }

      if (!map.getSource("area-geofence")) {
        map.addSource("area-geofence", {
          type: "geojson",
          data: geofencePolygon as any
        })
      }

      if (!map.getLayer("area-geofence-fill")) {
        map.addLayer({
          id: "area-geofence-fill",
          type: "fill",
          source: "area-geofence",
          paint: {
            "fill-color": "#0ea5e9",
            "fill-opacity": 0.12
          }
        })
      }

      if (!map.getLayer("area-geofence-outline")) {
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
      }

      if (!map.getSource("geofence-boundary")) {
        map.addSource("geofence-boundary", {
          type: "geojson",
          data: geofencePolyline as any
        })
      }

      if (!map.getLayer("geofence-boundary-line")) {
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
      }
    }
    ensureGeofenceLayersRef.current = ensureGeofenceLayers

    const scheduleDashboardRefresh = () => {
      if (dashboardRefreshTimer) {
        window.clearTimeout(dashboardRefreshTimer)
      }
      dashboardRefreshTimer = window.setTimeout(() => {
        dashboardRefreshTimer = undefined
        void refreshDashboardData()
      }, 250)
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

    const createDriverPopupContent = (driverIdentifier: string) => {
      const wrapper = document.createElement("div")
      wrapper.style.display = "grid"
      wrapper.style.gridTemplateColumns = "40px 1fr"
      wrapper.style.gap = "10px"
      wrapper.style.alignItems = "center"
      wrapper.style.minWidth = "190px"

      const avatarFrame = document.createElement("div")
      avatarFrame.style.width = "40px"
      avatarFrame.style.height = "40px"
      avatarFrame.style.borderRadius = "999px"
      avatarFrame.style.overflow = "hidden"
      avatarFrame.style.display = "grid"
      avatarFrame.style.placeItems = "center"
      avatarFrame.style.background = "#0f172a"
      avatarFrame.style.color = "#f8fafc"
      avatarFrame.style.fontSize = "13px"
      avatarFrame.style.fontWeight = "700"

      const avatarUrl = getDriverAvatarUrl(driverIdentifier)
      if (avatarUrl) {
        const imageEl = document.createElement("img")
        imageEl.src = avatarUrl
        imageEl.alt = getDriverLabel(driverIdentifier)
        imageEl.style.width = "100%"
        imageEl.style.height = "100%"
        imageEl.style.objectFit = "cover"
        imageEl.onerror = () => {
          avatarFrame.replaceChildren()
          avatarFrame.textContent = getDriverInitials(driverIdentifier)
        }
        avatarFrame.appendChild(imageEl)
      } else {
        avatarFrame.textContent = getDriverInitials(driverIdentifier)
      }

      const content = document.createElement("div")
      content.style.display = "grid"
      content.style.gap = "3px"

      const nameEl = document.createElement("strong")
      nameEl.textContent = getDriverLabel(driverIdentifier)

      const codeEl = document.createElement("div")
      codeEl.textContent = driverIdentifier
      codeEl.style.fontSize = "12px"
      codeEl.style.color = "#475569"

      content.appendChild(nameEl)
      content.appendChild(codeEl)
      wrapper.appendChild(avatarFrame)
      wrapper.appendChild(content)
      return wrapper
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

    const applyMarkerAppearance = (
      markerEl: HTMLDivElement,
      appearance: DriverMarkerAppearance
    ) => {
      const frameEl = markerEl.querySelector("[data-marker-frame]") as HTMLDivElement | null
      const badgeEl = markerEl.querySelector("[data-marker-badge]") as HTMLDivElement | null
      const arrowEl = markerEl.querySelector("[data-marker-arrow]") as HTMLDivElement | null
      const online = appearance.onlineStatus === "online"
      const frameColor = online
        ? appearance.inside
          ? "#22c55e"
          : "#ef4444"
        : "#94a3b8"
      const arrowColor = appearance.inside ? "#16a34a" : "#dc2626"

      if (frameEl) {
        frameEl.style.borderColor = frameColor
        frameEl.style.boxShadow = online
          ? appearance.inside
            ? "0 12px 28px rgba(34,197,94,0.28)"
            : "0 12px 28px rgba(239,68,68,0.28)"
          : "0 12px 28px rgba(148,163,184,0.24)"
      }
      if (badgeEl) {
        badgeEl.style.background = online ? "#22c55e" : "#94a3b8"
      }
      if (arrowEl) {
        arrowEl.style.background = online ? arrowColor : "#64748b"
        arrowEl.style.transform = `translate(-50%, -122%) rotate(${appearance.bearing}deg)`
      }
      markerEl.style.opacity = online ? "1" : "0.72"
    }

    const createMarkerElement = (
      driverIdentifier: string,
      appearance: DriverMarkerAppearance
    ) => {
      const markerEl = document.createElement("div")
      markerEl.dataset.driverIdentifier = driverIdentifier
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

      const arrowEl = document.createElement("div")
      arrowEl.setAttribute("data-marker-arrow", "true")
      arrowEl.style.position = "absolute"
      arrowEl.style.left = "50%"
      arrowEl.style.top = "50%"
      arrowEl.style.width = "14px"
      arrowEl.style.height = "14px"
      arrowEl.style.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)"
      arrowEl.style.transformOrigin = "50% 50%"
      arrowEl.style.boxShadow = "0 6px 14px rgba(15,23,42,0.22)"
      arrowEl.style.pointerEvents = "none"

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

      markerEl.appendChild(arrowEl)
      markerEl.appendChild(frameEl)
      markerEl.appendChild(badgeEl)
      markerEl.title = getDriverLabel(driverIdentifier)
      renderMarkerFrameContent(markerEl, driverIdentifier)
      applyMarkerAppearance(markerEl, appearance)
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

    const updateViolatorPresence = (
      identifiers: string[],
      driverOnlineStatus: "online" | "offline",
      lastSeenTs?: number
    ) => {
      updateViolatorsByTokens(identifiers, (violator) => ({
        ...violator,
        driverOnlineStatus,
        lastSeenTs: lastSeenTs ?? violator.lastSeenTs ?? null
      }))
    }

    const setDriverOffline = (driverIdentifier: string, identifiers: string[], lastSeenTs?: number) => {
      updateViolatorPresence(identifiers, "offline", lastSeenTs)
      driverMarkerManagerRef.current?.setOffline([driverIdentifier, ...identifiers], lastSeenTs)
      setDriversById((previous) => {
        const existing = previous[driverIdentifier]
        if (!existing) return previous
        return {
          ...previous,
          [driverIdentifier]: {
            ...existing,
            lastSeenTs: Math.max(existing.lastSeenTs, lastSeenTs ?? existing.lastSeenTs),
            onlineStatus: "offline"
          }
        }
      })
    }

    const removeDriverLivePresence = (driverIdentifier: string, identifiers: string[]) => {
      updateViolatorPresence(identifiers, "offline")
      driverMarkerManagerRef.current?.remove([driverIdentifier, ...identifiers])
      removeDriverState(driverIdentifier)
    }

    const upsertDriverState = (
      event: DriverLocationEvent,
      isViolation: boolean,
      onlineStatus: DriverMarkerOnlineStatus,
      acceptedLocation = true
    ) => {
      setDriversById((previous) => {
        const existing = previous[event.driverId]
        const dedupedRecent = acceptedLocation
          ? [event, ...(existing?.recentPoints ?? [])]
              .sort((a, b) => b.ts - a.ts)
              .filter((point, index, all) => {
                const signature = createPointSignature(point)
                return (
                  index ===
                  all.findIndex((candidate) => createPointSignature(candidate) === signature)
                )
              })
              .slice(0, RECENT_POINTS_PER_DRIVER)
          : (existing?.recentPoints ?? [])
        return {
          ...previous,
          [event.driverId]: {
            driverId: event.driverId,
            lastSeenTs: Math.max(existing?.lastSeenTs ?? 0, event.ts),
            latestPoint: acceptedLocation ? event : (existing?.latestPoint ?? event),
            violationCount: (existing?.violationCount ?? 0) + (isViolation ? 1 : 0),
            recentPoints: dedupedRecent,
            onlineStatus
          }
        }
      })
    }

    map.on("style.load", () => {
      ensureGeofenceLayers(false)
    })

    map.on("idle", () => {
      ensureGeofenceLayers(false)
    })

    map.on("load", () => {
      ensureGeofenceLayers(true)

      driverMarkerManagerRef.current = createSmoothDriverMarkerManager({
        map,
        createMarkerElement,
        getPopupContent: createDriverPopupContent,
        updateMarkerElement: (markerEl, appearance) => {
          const driverIdentifier = markerEl.dataset.driverIdentifier ?? ""
          markerEl.title = getDriverLabel(driverIdentifier)
          renderMarkerFrameContent(markerEl, driverIdentifier)
          applyMarkerAppearance(markerEl, appearance)
        }
      })

      const updateMarker = (
        event: DriverLocationEvent,
        inside: boolean,
        identifiers: string[]
      ) =>
        driverMarkerManagerRef.current?.upsert({
          driverIdentifier: event.driverId,
          aliases: identifiers,
          position: {
            lng: event.lng,
            lat: event.lat
          },
          timestamp: event.ts,
          accuracy: event.accuracy,
          heading: event.heading,
          speed: event.speed,
          inside,
          onlineStatus: "online"
        }) ?? { accepted: false, snapped: false, position: null }

      const handleLocationEvent = (event: DriverLocationEvent, identifiers: string[]) => {
        if (!isDriverVisibleToAdmin(event.driverId)) return
        const inside = turf.booleanPointInPolygon(
          turf.point([event.lng, event.lat]),
          geofencePolygon as any
        )
        const driver = getDashboardDriverByIdentifier(event.driverId)
        const operationalState =
          driver && dashboardDataRef.current?.operationalDrivers.find(
            (item) => item.driverId === driver.driverId
          )
        const trip = getDashboardTripForViolation(
          driver?.driverId,
          event.tripId ?? operationalState?.activeTripId
        )
        const activeTripId = event.tripId ?? operationalState?.activeTripId ?? trip?.tripId
        const driverTokens = buildDriverTokens(driver?.driverCode ?? event.driverId, driver?.driverId)
        const driverKey = getViolatorDriverKey({
          driverCode: driver?.driverCode ?? event.driverId,
          driverId: driver?.driverId
        })
        const previousInside = driverInsideStateRef.current[event.driverId]
        const hadLivePresenceBefore = Boolean(driversByIdRef.current[event.driverId])
        const markerUpdate = updateMarker(event, inside, identifiers)
        upsertDriverState(event, !inside && markerUpdate.accepted, "online", markerUpdate.accepted)
        updateViolatorPresence(driverTokens, "online", event.ts)

        if (!markerUpdate.accepted) {
          return
        }

        const shouldTriggerLiveGeofenceAlert =
          !inside && Boolean(driverKey) && (previousInside !== false || !hadLivePresenceBefore)

        if (!inside && driverKey) {
          upsertLiveViolator({
            driverKey,
            driverId: driver?.driverCode ?? event.driverId,
            driverName: driver ? `${driver.firstName} ${driver.lastName}` : event.driverId,
            avatarUrl: driver?.avatarUrl ?? null,
            latitude: event.lat,
            longitude: event.lng,
            violationType: "Outside geofence",
            timestamp: new Date(event.ts).toISOString(),
            status: "active",
            violationId: `live-${event.driverId}-${activeTripId ?? "no-trip"}-${event.ts}`,
            source: "live_geofence",
            locationLabel: "Location name unavailable",
            tripId: activeTripId,
            routeName: trip?.routeName ?? operationalState?.activeRouteName,
            resolvedAt: null,
            driverOnlineStatus: "online",
            lastSeenTs: event.ts,
            uiDismissedByAdmin: false,
            driverTokens
          })
        }

        driverInsideStateRef.current[event.driverId] = inside
        if (!shouldTriggerLiveGeofenceAlert || !driverKey) return

        const timestamp = new Date(event.ts).toISOString()
        queueViolationAlert({
          key: `live-geofence-${event.driverId}-${createPointSignature(event)}`,
          source: "live_geofence",
          driverId: driver?.driverId,
          driverCode: driver?.driverCode ?? event.driverId,
          driverName: driver ? `${driver.firstName} ${driver.lastName}` : undefined,
          profileImageUrl: driver?.avatarUrl,
          plateNo: driver?.tricycleNo ?? operationalState?.plateNo ?? trip?.plateNo,
          tricycleNo: driver?.tricycleNo ?? operationalState?.plateNo ?? trip?.plateNo,
          tricycleId: driver?.tricycleId ?? operationalState?.tricycleId ?? trip?.tricycleId,
          tripId: activeTripId,
          routeName: trip?.routeName ?? operationalState?.activeRouteName,
          violationType: "Geofence Deviation",
          timestamp,
          locationLabel: "Location name unavailable",
          description: "Driver went outside the active geofence boundary.",
          lat: event.lat,
          lng: event.lng
        })
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

      const isLiveLocationRowOnline = (row: LiveDriverLocationRow) => {
        const lastSeenTs = new Date(row.recorded_at ?? row.updated_at).getTime()
        return row.is_online && isFreshPresence(lastSeenTs, Date.now())
      }

      const applyLocationRow = async (row: LiveDriverLocationRow) => {
        const driverIdentifier = row.driver_code.trim().toUpperCase()
        const identifiers = [driverIdentifier, String(row.driver_id)]
        const lastSeenTs = new Date(row.recorded_at ?? row.updated_at).getTime()
        if (!isLiveLocationRowOnline(row)) {
          setDriverOffline(driverIdentifier, identifiers, lastSeenTs)
          return
        }

        const locationEvent = toLocationEventFromRow(row)
        if (!isDriverVisibleToAdmin(locationEvent.driverId)) {
          removeDriverLivePresence(driverIdentifier, identifiers)
          return
        }
        handleLocationEvent(locationEvent, identifiers)
        if (active) setLastUpdateTs(locationEvent.ts)
      }

      const loadLiveDriverLocations = async () => {
        const hiddenIdentifiers = Object.keys(driversByIdRef.current).filter(
          (driverIdentifier) => !isDriverVisibleToAdmin(driverIdentifier)
        )
        if (hiddenIdentifiers.length > 0) {
          for (const driverIdentifier of hiddenIdentifiers) {
            removeDriverLivePresence(driverIdentifier, [driverIdentifier])
          }
        }

        setSyncStatus("connecting")
        const { data, error } = await supabase
          .from("driver_locations")
          .select(
            "driver_id,driver_code,latitude,longitude,speed,heading,accuracy,is_online,recorded_at,updated_at"
          )
          .eq("is_online", true)
          .gte("updated_at", new Date(Date.now() - DRIVER_PRESENCE_STALE_MS).toISOString())

        if (error) {
          console.warn("Live driver location hydration failed:", error.message)
          if (active) setSyncStatus("disconnected")
          return
        }

        const onlineIdentifiers = new Set<string>()
        for (const row of (data ?? []) as LiveDriverLocationRow[]) {
          onlineIdentifiers.add(row.driver_code.trim().toUpperCase())
          onlineIdentifiers.add(String(row.driver_id))
          await applyLocationRow(row)
        }

        const staleIdentifiers = Object.keys(driversByIdRef.current).filter(
          (driverIdentifier) => !onlineIdentifiers.has(driverIdentifier)
        )
        if (staleIdentifiers.length > 0) {
          for (const driverIdentifier of staleIdentifiers) {
            const lastSeenTs = driversByIdRef.current[driverIdentifier]?.lastSeenTs
            setDriverOffline(driverIdentifier, [driverIdentifier], lastSeenTs)
          }
        }

        if (active) {
          setLivePresenceHydrated(true)
          setSyncStatus("connected")
        }
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
        if (dashboardEventChannel) {
          void supabase.removeChannel(dashboardEventChannel)
          dashboardEventChannel = null
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
              const previousRow = payload.old as LiveDriverLocationRow | undefined
              const nextRow = payload.new as LiveDriverLocationRow | undefined
              const row = (nextRow || previousRow) as LiveDriverLocationRow | undefined
              if (!row) return
              const driverIdentifier = row.driver_code.trim().toUpperCase()
              if (payload.eventType === "DELETE") {
                removeDriverLivePresence(driverIdentifier, [
                  driverIdentifier,
                  String(row.driver_id)
                ])
                scheduleDashboardRefresh()
                return
              }
              if ((nextRow?.is_online ?? null) !== (previousRow?.is_online ?? null)) {
                scheduleDashboardRefresh()
              }
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

        dashboardEventChannel = supabase
          .channel(`dashboard-events-${adminProfile.adminId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "trips"
            },
            () => {
              if (!active) return
              scheduleDashboardRefresh()
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "trip_paths"
            },
            () => {
              if (!active) return
              scheduleDashboardRefresh()
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "mobile_violations"
            },
            (payload) => {
              if (!active) return
              if (payload.eventType === "INSERT") {
                const insertedRow = payload.new as { id?: string } | undefined
                if (typeof insertedRow?.id === "string" && insertedRow.id.trim()) {
                  const violationKey = getStoredViolationKey("driver_violation", `driver-${insertedRow.id}`)
                  if (
                    !knownViolationKeysRef.current.has(violationKey) &&
                    !shownViolationPopupKeysRef.current.has(violationKey)
                  ) {
                    pendingViolationPopupKeysRef.current.add(violationKey)
                  }
                }
              }
              scheduleDashboardRefresh()
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "driver_password_reset_requests"
            },
            () => {
              if (!active) return
              scheduleDashboardRefresh()
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "violations"
            },
            (payload) => {
              if (!active) return
              if (payload.eventType === "INSERT") {
                const insertedRow = payload.new as { violation_id?: number | string } | undefined
                if (
                  insertedRow?.violation_id !== undefined &&
                  insertedRow.violation_id !== null &&
                  String(insertedRow.violation_id).trim()
                ) {
                  const violationKey = getStoredViolationKey(
                    "system_violation",
                    `system-${String(insertedRow.violation_id)}`
                  )
                  if (
                    !knownViolationKeysRef.current.has(violationKey) &&
                    !shownViolationPopupKeysRef.current.has(violationKey)
                  ) {
                    pendingViolationPopupKeysRef.current.add(violationKey)
                  }
                }
              }
              scheduleDashboardRefresh()
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "drivers"
            },
            () => {
              if (!active) return
              scheduleDashboardRefresh()
            }
          )
          .subscribe()
      }

      const handleOnlineState = () => {
        const isOnline = navigator.onLine
        setOnline(isOnline)
        if (isOnline) {
          void loadLiveDriverLocations()
          connectRealtime()
        } else {
          setSyncStatus("disconnected")
        }
      }

      onlineHandler = handleOnlineState
      if (offlineViewerMode) {
        setOnline(false)
        setSyncStatus("disconnected")
        setLivePresenceHydrated(true)
        return
      }
      window.addEventListener("online", handleOnlineState)
      window.addEventListener("offline", handleOnlineState)
      void loadLiveDriverLocations()
      connectRealtime()
      stalePresenceTimer = window.setInterval(() => {
        const nowTs = Date.now()
        const staleIdentifiers = Object.entries(driversByIdRef.current).filter(
          ([, driverState]) =>
            driverState.onlineStatus === "online" && !isFreshPresence(driverState.lastSeenTs, nowTs)
        )

        for (const [driverIdentifier, driverState] of staleIdentifiers) {
          setDriverOffline(driverIdentifier, [driverIdentifier], driverState.lastSeenTs)
        }
      }, 15000)
    })

    return () => {
      active = false
      if (refreshLiveLocationsRef.current) {
        refreshLiveLocationsRef.current = null
      }
      if (liveLocationChannel) {
        void supabase.removeChannel(liveLocationChannel)
      }
      if (dashboardEventChannel) {
        void supabase.removeChannel(dashboardEventChannel)
      }
      if (dashboardRefreshTimer) {
        window.clearTimeout(dashboardRefreshTimer)
      }
      if (stalePresenceTimer) {
        window.clearInterval(stalePresenceTimer)
      }
      if (onlineHandler) {
        window.removeEventListener("online", onlineHandler)
        window.removeEventListener("offline", onlineHandler)
      }
      ensureGeofenceLayersRef.current = null
      driverMarkerManagerRef.current?.destroy()
      driverMarkerManagerRef.current = null
      violationFocusMarkerRef.current?.remove()
      violationFocusMarkerRef.current = null
      map.remove()
      mapRef.current = null
      geofenceBoundsRef.current = null
    }
  }, [accessToken, adminProfile.adminId, adminProfile.role, offlineViewerMode])

  useEffect(() => {
    if (showLiveMapView && mapRef.current) {
      window.setTimeout(() => {
        mapRef.current?.resize()
        ensureGeofenceLayersRef.current?.(activePage === "live-map")
      }, 0)
    }
  }, [activePage, showLiveMapView])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (appliedMapStyleRef.current === selectedMapStyle) {
      ensureGeofenceLayersRef.current?.(false)
      return
    }

    appliedMapStyleRef.current = selectedMapStyle
    map.setStyle(createRasterStyle(selectedMapStyle) as maplibregl.StyleSpecification)
    ensureGeofenceLayersRef.current?.(false)
  }, [selectedMapStyle])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedViolator || !showLiveMapView) {
      if (!selectedViolator) {
        violationFocusMarkerRef.current?.remove()
        violationFocusMarkerRef.current = null
      }
      setSelectedViolationPopupPosition(null)
      return
    }

    let animationFrameId: number | null = null
    const getLngLat = (): [number, number] => {
      const livePosition = driverMarkerManagerRef.current?.getDisplayedPosition(
        getViolatorTrackingIdentifiers(selectedViolator)
      )
      return livePosition
        ? [livePosition.lng, livePosition.lat]
        : [selectedViolator.longitude, selectedViolator.latitude]
    }

    const syncPopupPosition = () => {
      const lngLat = getLngLat()
      if (!violationFocusMarkerRef.current) {
        violationFocusMarkerRef.current = new maplibregl.Marker({
          element: createViolationMarkerElement()
        })
          .setLngLat(lngLat)
          .addTo(map)
      } else {
        violationFocusMarkerRef.current.setLngLat(lngLat)
      }

      const point = map.project(lngLat)
      const container = map.getContainer()
      const align = point.x > container.clientWidth - 280 ? "left" : "right"
      setSelectedViolationPopupPosition({
        x: Math.round(point.x),
        y: Math.round(point.y),
        align
      })
    }

    syncPopupPosition()
    map.on("move", syncPopupPosition)
    map.on("zoom", syncPopupPosition)
    map.on("resize", syncPopupPosition)

    const syncDuringAnimation = () => {
      syncPopupPosition()
      animationFrameId = window.requestAnimationFrame(syncDuringAnimation)
    }
    animationFrameId = window.requestAnimationFrame(syncDuringAnimation)

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }
      map.off("move", syncPopupPosition)
      map.off("zoom", syncPopupPosition)
      map.off("resize", syncPopupPosition)
    }
  }, [selectedViolator, showLiveMapView])

  const handleViolatorSelect = (violator: LiveMapViolator) => {
    if (selectedViolatorKey === violator.driverKey) {
      setSelectedViolatorKey(null)
      return
    }

    setSelectedViolatorKey(violator.driverKey)
    setActivePage("live-map")
    window.setTimeout(() => {
      const map = mapRef.current
      if (!map) return
      const livePosition = driverMarkerManagerRef.current?.getDisplayedPosition(
        getViolatorTrackingIdentifiers(violator)
      )
      map.resize()
      map.flyTo({
        center: livePosition
          ? [livePosition.lng, livePosition.lat]
          : [violator.longitude, violator.latitude],
        zoom: Math.max(map.getZoom(), 16.2),
        speed: 0.95,
        curve: 1.3,
        essential: true
      })
    }, 80)
  }

  const operationalDriversById = useMemo(() => {
    return new Map(
      (dashboardData?.operationalDrivers ?? []).map((driver) => [driver.driverId, driver])
    )
  }, [dashboardData?.operationalDrivers])

  const driverDirectoryRows = useMemo<DriverDirectoryRow[]>(() => {
    const directory = new Map<string, DriverDirectoryRow>()

    for (const driver of dashboardData?.drivers ?? []) {
      const numericDriverId = String(driver.driverId)
      directory.set(numericDriverId, {
        ...driver,
        liveState: driversById[driver.driverCode] ?? driversById[numericDriverId],
        operationalState: operationalDriversById.get(driver.driverId)
      })
    }

    return [...directory.values()].sort((a, b) => {
      const aLastSeen = a.liveState?.lastSeenTs ?? 0
      const bLastSeen = b.liveState?.lastSeenTs ?? 0
      if (aLastSeen !== bLastSeen) return bLastSeen - aLastSeen
      return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
    })
  }, [dashboardData?.drivers, driversById, operationalDriversById])

  const activeDriverRows = useMemo(() => {
    return driverDirectoryRows.filter((driver) => {
      return isDriverOnlineNow(driver, clockTs, livePresenceHydrated)
    })
  }, [driverDirectoryRows, clockTs, livePresenceHydrated])

  const selectedDriver = useMemo(() => {
    if (selectedDriverId === null) return null
    return driverDirectoryRows.find((driver) => driver.driverId === selectedDriverId) ?? null
  }, [driverDirectoryRows, selectedDriverId])

  const selectedDriverPasswordResetRequests = useMemo(() => {
    if (!selectedDriver) return []
    return (dashboardData?.passwordResetRequests ?? []).filter(
      (request) => request.driverId === selectedDriver.driverId
    )
  }, [dashboardData?.passwordResetRequests, selectedDriver])

  const pendingPasswordResetRequests = useMemo(
    () => (dashboardData?.passwordResetRequests ?? []).filter((request) => request.status === "pending"),
    [dashboardData?.passwordResetRequests]
  )

  const activeDriverCount = activeDriverRows.length

  const systemDriverStats = useMemo(() => {
    const inTransitCount = driverDirectoryRows.filter(
      (driver) => driver.operationalState?.operationalStatus === "on_trip"
    ).length
    const idleCount = driverDirectoryRows.filter(
      (driver) =>
        driver.operationalState?.operationalStatus === "online_idle" ||
        (isDriverOnlineNow(driver, clockTs, livePresenceHydrated) &&
          driver.operationalState?.operationalStatus !== "on_trip")
    ).length
    const setupPendingCount = driverDirectoryRows.filter((driver) => !driver.passwordSet).length

    return {
      total: driverDirectoryRows.length,
      active: activeDriverCount,
      inTransit: inTransitCount,
      idle: idleCount,
      setupPending: setupPendingCount,
      passwordResetPending: pendingPasswordResetRequests.length
    }
  }, [activeDriverCount, clockTs, driverDirectoryRows, livePresenceHydrated, pendingPasswordResetRequests.length])

  const activeTricycleCount = useMemo(() => {
    const activeTricycleKeys = new Set<string>()

    for (const driver of activeDriverRows) {
      if (driver.tricycleId) {
        activeTricycleKeys.add(`id:${driver.tricycleId}`)
        continue
      }

      const normalizedTricycleNo = driver.tricycleNo?.trim().toUpperCase()
      if (normalizedTricycleNo) {
        activeTricycleKeys.add(`plate:${normalizedTricycleNo}`)
        continue
      }

      activeTricycleKeys.add(`driver:${driver.driverId}`)
    }

    return activeTricycleKeys.size
  }, [activeDriverRows])

  const totalTripsToday = useMemo(() => {
    return dashboardData?.counts.tripsToday ?? 0
  }, [dashboardData?.counts.tripsToday])

  const filteredAllDriverRows = useMemo(() => {
    if (!hasSearchQuery) return driverDirectoryRows
    return driverDirectoryRows.filter((driver) =>
      driverMatchesSearch(driver, normalizedSearchQuery)
    )
  }, [driverDirectoryRows, hasSearchQuery, normalizedSearchQuery])

  const filteredActiveDriverRows = useMemo(() => {
    if (!hasSearchQuery) return activeDriverRows
    return activeDriverRows.filter((driver) =>
      driverMatchesSearch(driver, normalizedSearchQuery)
    )
  }, [activeDriverRows, hasSearchQuery, normalizedSearchQuery])

  const alertRows = useMemo<AlertListItem[]>(() => {
    return [
      ...(dashboardData?.recentEmergencies ?? []).map(createStoredEmergencyAlertListItem),
      ...(dashboardData?.recentViolations ?? []).map(createStoredAlertListItem)
    ]
      .sort((a, b) => b.ts - a.ts)
  }, [dashboardData?.recentEmergencies, dashboardData?.recentViolations])

  const filteredAlerts = useMemo(() => {
    if (!hasSearchQuery) return alertRows
    return alertRows.filter((alert) => {
      return (
        textMatchesSearch(
          normalizedSearchQuery,
          alert.key,
          alert.driverId,
          alert.driverName,
          alert.reason,
          alert.description,
          alert.plateNo,
          alert.routeName,
          alert.todaName,
          alert.barangayName,
          alert.status,
          alert.source,
          alert.emergencyId,
          alert.description
        )
      )
    })
  }, [alertRows, hasSearchQuery, normalizedSearchQuery])

  const alertStats = useMemo(() => {
    const open = alertRows.filter((item) => item.status === "open").length
    const emergency = alertRows.filter((item) => item.source === "emergency").length
    const resolved = alertRows.filter((item) => item.status === "resolved").length

    return {
      total: alertRows.length,
      open,
      emergency,
      resolved
    }
  }, [alertRows])

  const homeAlertSummary = useMemo(() => {
    return [...filteredAlerts]
      .sort((a, b) => b.ts - a.ts || String(b.key).localeCompare(String(a.key)))
      .slice(0, HOME_ALERT_SUMMARY_LIMIT)
  }, [filteredAlerts])

  const tripRows = useMemo(() => {
    return dashboardData?.recentTrips ?? []
  }, [dashboardData?.recentTrips])

  const activeTripIds = useMemo(() => {
    return new Set(
      (dashboardData?.operationalDrivers ?? [])
        .filter((driver) => driver.operationalStatus === "on_trip")
        .map((driver) => driver.activeTripId)
        .filter((tripId): tripId is number => typeof tripId === "number")
    )
  }, [dashboardData?.operationalDrivers])

  const getTripDisplayStatus = (trip: DashboardTripRecord): TripDisplayStatus => {
    if (trip.tripStatus === "cancelled") return "cancelled"
    if (trip.tripStatus === "completed") {
      return trip.tripEnd ? "completed" : "incomplete"
    }
    if (trip.tripStatus === "ongoing") {
      return activeTripIds.has(trip.tripId) ? "ongoing" : "incomplete"
    }
    return "incomplete"
  }

  const selectedAlertTrip = useMemo(() => {
    if (!selectedAlertDetails) return undefined
    const tripId =
      selectedAlertDetails.kind === "violation"
        ? selectedAlertDetails.record.tripId
        : selectedAlertDetails.record.tripId

    if (tripId !== undefined) {
      const directTrip = tripRows.find((trip) => trip.tripId === tripId)
      if (directTrip) return directTrip
    }

    const driverId =
      selectedAlertDetails.kind === "violation"
        ? selectedAlertDetails.record.driverId
        : selectedAlertDetails.record.driverId

    return tripRows
      .filter((trip) => trip.driverId === driverId)
      .sort(
        (a, b) =>
          new Date(b.tripEnd ?? b.tripStart).getTime() -
          new Date(a.tripEnd ?? a.tripStart).getTime()
      )[0]
  }, [selectedAlertDetails, tripRows])

  const openAlertDetails = (alert: AlertListItem) => {
    setAlertDetailsError(null)
    if (alert.source === "emergency" && alert.emergencyId !== undefined) {
      const record = (dashboardData?.recentEmergencies ?? []).find(
        (item) => item.emergencyId === alert.emergencyId
      )
      if (record) {
        console.log("🚨 OPENING EMERGENCY DETAILS:", { emergencyId: record.emergencyId, latitude: record.latitude, longitude: record.longitude })
        setSelectedAlertDetails({ kind: "emergency", item: alert, record })
      }
      return
    }

    if (alert.violationId && alert.alertSource) {
      const record = (dashboardData?.recentViolations ?? []).find(
        (item) =>
          item.violationId === alert.violationId && item.alertSource === alert.alertSource
      )
      if (record) {
        setSelectedAlertDetails({ kind: "violation", item: alert, record })
      }
    }
  }

  const notificationItems = useMemo<NotificationItem[]>(() => {
    return (dashboardData?.notifications ?? [])
      .map((item): NotificationItem => ({
        key: item.notificationKey,
        kind: item.kind,
        page: item.page,
        title: item.title,
        body: item.body,
        ts: new Date(item.timestamp).getTime(),
        priority: item.priority,
        tone: item.tone,
        sourceEntityId: item.sourceEntityId,
        isRead: item.isRead
      }))
      .sort(sortNotificationsByRecency)
  }, [dashboardData?.notifications])

  useEffect(() => {
    const pending = (dashboardData?.recentEmergencies ?? []).filter(
      (item) => item.status === "created" || item.status === "pending_admin"
    )

    if (pending.length === 0) {
      if (activeEmergencyModal && activeEmergencyModal.status !== "responding") {
        setActiveEmergencyModal(null)
      }
      setEmergencyQueue([])
      return
    }

    const sorted = [...pending].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
        b.emergencyId - a.emergencyId
    )

    setEmergencyQueue((current) => {
      const next = [...current]
      for (const item of sorted) {
        if (
          !next.some((queued) => queued.emergencyId === item.emergencyId) &&
          activeEmergencyModal?.emergencyId !== item.emergencyId
        ) {
          next.push(item)
        }
      }
      return next
    })

    if (
      !activeEmergencyModal ||
      !sorted.some((item) => item.emergencyId === activeEmergencyModal.emergencyId)
    ) {
      setActiveEmergencyModal(sorted[0])
    }
  }, [dashboardData?.recentEmergencies, activeEmergencyModal])

  useEffect(() => {
    const violations = dashboardData?.recentViolations ?? []
    const outsideGeofenceViolations = violations
      .filter((violation) => isOutsideGeofenceViolation(violation))
      .map((violation) => {
        const resolvedAt =
          (violation as DashboardViolationRecord & { resolvedAt?: string; resolved_at?: string })
            .resolvedAt ??
          (violation as DashboardViolationRecord & { resolvedAt?: string; resolved_at?: string })
            .resolved_at ??
          null

        return {
          violation,
          resolvedAt,
          active: isViolatorActive({ status: violation.status, resolvedAt })
        }
      })

    const hasAnyTodayViolation = outsideGeofenceViolations.some(
      ({ violation, active }) =>
        active && isSameLocalCalendarDay(new Date(violation.detectedAt).getTime(), clockTs)
    )
    const closedStoredDismissalKeys = new Set(
      outsideGeofenceViolations
        .filter(({ active }) => !active)
        .map(({ violation }) =>
          getViolatorDismissalKey({
            source: violation.alertSource,
            violationId: String(violation.violationId)
          })
        )
    )

    setStoredViolatorsByKey((current) => {
      const next = { ...current }
      let changed = false

      for (const [driverKey, violator] of Object.entries(current)) {
        if (
          (violator.source === "system_violation" || violator.source === "driver_violation") &&
          closedStoredDismissalKeys.has(getViolatorDismissalKey(violator))
        ) {
          delete next[driverKey]
          changed = true
        }
      }

      for (const { violation, resolvedAt, active } of outsideGeofenceViolations) {
        if (!active) continue

        const driver = violation.driverId
          ? dashboardData?.drivers.find((item) => item.driverId === violation.driverId)
          : undefined
        if (!driver) {
          continue
        }
        const operationalState = violation.driverId
          ? dashboardData?.operationalDrivers.find((item) => item.driverId === violation.driverId)
          : undefined
        const liveState = driver
          ? driversByIdRef.current[driver.driverCode] ??
            driversByIdRef.current[String(driver.driverId)]
          : undefined
        const latitude =
          violation.latitude ?? operationalState?.latitude ?? liveState?.latestPoint.lat
        const longitude =
          violation.longitude ?? operationalState?.longitude ?? liveState?.latestPoint.lng
        if (typeof latitude !== "number" || typeof longitude !== "number") continue

        const driverKey = getViolatorDriverKey({
          driverCode: violation.driverCode ?? driver?.driverCode,
          driverId: violation.driverId
        })
        if (!driverKey) continue

        const nextViolator: MapViolatorRecord = {
          driverKey,
          driverId:
            violation.driverCode ?? driver?.driverCode ?? String(violation.driverId ?? "N/A"),
          driverName:
            violation.driverName ??
            (driver ? `${driver.firstName} ${driver.lastName}` : "Unknown driver"),
          avatarUrl: driver?.avatarUrl ?? null,
          latitude,
          longitude,
          violationType: "Outside geofence",
          timestamp: violation.detectedAt,
          status: violation.status,
          violationId: String(violation.violationId),
          source: violation.alertSource,
          locationLabel: getReadableLocationLabel(violation.locationLabel),
          tripId: violation.tripId,
          routeName: violation.routeName ?? operationalState?.activeRouteName,
          resolvedAt,
          driverOnlineStatus: liveState ? "online" : "offline",
          lastSeenTs: liveState?.lastSeenTs ?? null,
          uiDismissedByAdmin: false,
          driverTokens: buildDriverTokens(
            violation.driverCode ?? driver?.driverCode,
            violation.driverId
          )
        }

        const dismissalKey = getViolatorDismissalKey(nextViolator)
        const existing = current[driverKey]
        const keepExistingViolation =
          existing && getViolatorDismissalKey(existing) === dismissalKey
        const qualifiesNow =
          keepExistingViolation ||
          qualifiesForFreshViolatorStack(nextViolator.timestamp, clockTs, hasAnyTodayViolation)
        const dismissedState = dismissedViolatorsByDriver[driverKey]
        const isCurrentViolationDismissed =
          dismissedState?.dismissalKey === dismissalKey

        if (!qualifiesNow || isCurrentViolationDismissed) {
          continue
        }

        const existingByDriver = next[driverKey]
        if (
          existingByDriver &&
          existingByDriver.violationId === nextViolator.violationId &&
          existingByDriver.timestamp === nextViolator.timestamp &&
          existingByDriver.latitude === nextViolator.latitude &&
          existingByDriver.longitude === nextViolator.longitude &&
          existingByDriver.driverOnlineStatus === nextViolator.driverOnlineStatus &&
          existingByDriver.lastSeenTs === nextViolator.lastSeenTs
        ) {
          continue
        }

        next[driverKey] = nextViolator
        changed = true
      }

      return changed ? next : current
    })

    const nextKnownKeys = new Set(
      violations.map((item) => getStoredViolationKey(item.alertSource, item.violationId))
    )

    if (!violationsHydratedRef.current) {
      knownViolationKeysRef.current = nextKnownKeys
      violationsHydratedRef.current = true
      return
    }

    const newViolations = violations
      .filter((item) => {
        const key = getStoredViolationKey(item.alertSource, item.violationId)
        return pendingViolationPopupKeysRef.current.has(key)
      })
      .sort(
        (a, b) =>
          new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime()
      )

    knownViolationKeysRef.current = nextKnownKeys

    for (const violation of newViolations) {
      const violationKey = getStoredViolationKey(violation.alertSource, violation.violationId)
      pendingViolationPopupKeysRef.current.delete(violationKey)

      if (violation.status !== "open" && violation.status !== "under_review") continue
      if (shownViolationPopupKeysRef.current.has(violationKey)) continue

      const driver = violation.driverId
        ? dashboardData?.drivers.find((item) => item.driverId === violation.driverId)
        : undefined
      if (!driver) continue
      const operationalState = violation.driverId
        ? dashboardData?.operationalDrivers.find((item) => item.driverId === violation.driverId)
        : undefined
      const trip = getDashboardTripForViolation(violation.driverId, violation.tripId)
      const activeTripId = violation.tripId ?? operationalState?.activeTripId ?? trip?.tripId
      const hasActiveTrip =
        activeTripId !== undefined ||
        operationalState?.operationalStatus === "on_trip" ||
        trip?.tripStatus === "ongoing"
      if (!hasActiveTrip) continue

      const lat = violation.latitude ?? operationalState?.latitude
      const lng = violation.longitude ?? operationalState?.longitude
      queueViolationAlert({
        key: `stored-${violation.alertSource}-${violation.violationId}`,
        source: violation.alertSource,
        driverId: violation.driverId,
        driverCode: violation.driverCode ?? driver?.driverCode,
        driverName:
          violation.driverName ??
          (driver ? `${driver.firstName} ${driver.lastName}` : undefined),
        profileImageUrl: driver?.avatarUrl,
        plateNo: violation.plateNo ?? driver?.tricycleNo ?? trip?.plateNo,
        tricycleNo: violation.plateNo ?? driver?.tricycleNo ?? trip?.plateNo,
        tricycleId: violation.tricycleId ?? driver?.tricycleId ?? trip?.tricycleId,
        tripId: activeTripId,
        routeName: violation.routeName ?? trip?.routeName ?? operationalState?.activeRouteName,
        violationType: violation.violationTypeLabel,
        timestamp: violation.detectedAt,
        locationLabel: getReadableLocationLabel(violation.locationLabel),
        description: removeCoordinateText(violation.description),
        lat,
        lng
      })
      shownViolationPopupKeysRef.current.add(violationKey)
    }
  }, [
    clockTs,
    dashboardData?.recentViolations,
    dashboardData?.drivers,
    dashboardData?.operationalDrivers,
    dashboardData?.recentTrips,
    dismissedViolatorsByDriver,
    driversById
  ])

  useEffect(() => {
    if (!selectedViolatorKey) return
    if (activeViolators.some((violator) => violator.driverKey === selectedViolatorKey)) return
    setSelectedViolatorKey(null)
  }, [activeViolators, selectedViolatorKey])

  useEffect(() => {
    if (offlineViewerMode) return

    const closeStream = connectAdminEmergencyStream(accessToken, {
      onSnapshot: (items) => {
        console.log("🚨 EMERGENCIES SNAPSHOT RECEIVED:", items.map(item => ({ emergencyId: item.emergencyId, latitude: item.latitude, longitude: item.longitude })))
        const pending = items
          .filter((item) => item.status === "created" || item.status === "pending_admin")
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
              b.emergencyId - a.emergencyId
          )

        setActiveEmergencyModal((current) => current ?? pending[0] ?? null)
      },
      onEmergency: (alert) => {
        if (alert.status === "created" || alert.status === "pending_admin") {
          setEmergencyQueue((current) => {
            const withoutCurrent = current.filter((item) => item.emergencyId !== alert.emergencyId)
            return [...withoutCurrent, alert].sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
                b.emergencyId - a.emergencyId
            )
          })
          setActiveEmergencyModal((current) => current ?? alert)
        } else {
          setEmergencyQueue((current) =>
            current.filter((item) => item.emergencyId !== alert.emergencyId)
          )
          setActiveEmergencyModal((current) =>
            current?.emergencyId === alert.emergencyId ? null : current
          )
        }

        void refreshDashboardData()
      }
    })

    return () => {
      closeStream()
    }
  }, [accessToken, offlineViewerMode])

  useEffect(() => {
    if (offlineViewerMode) return

    const appealsChannel = supabase
      .channel("admin-appeal-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "violation_appeals"
        },
        () => {
          void refreshDashboardData()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(appealsChannel)
    }
  }, [accessToken, offlineViewerMode])

  useEffect(() => {
    if (offlineViewerMode) return

    const passwordResetChannel = supabase
      .channel("admin-password-reset-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "driver_password_reset_requests",
          filter: "status=eq.pending"
        },
        () => {
          void refreshDashboardData()
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "driver_password_reset_requests",
          filter: "status=eq.pending"
        },
        () => {
          void refreshDashboardData()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(passwordResetChannel)
    }
  }, [accessToken, offlineViewerMode])

  const handleEmergencyResponse = async (alert: DashboardEmergencyRecord) => {
    if (dashboardReadOnly) {
      setDashboardError("Offline mode is read-only. Reconnect to respond to emergencies.")
      return
    }
    setEmergencyActionBusyId(alert.emergencyId)
    try {
      const updatedAlert = await updateEmergencyAlertStatus(
        accessToken,
        alert.emergencyId,
        "responding"
      )
      await refreshDashboardData()

      const alertItem: AlertListItem = {
        key: `emergency-${updatedAlert.emergencyId}`,
        source: "emergency",
        emergencyId: updatedAlert.emergencyId,
        driverId: String(updatedAlert.driverId),
        driverName: updatedAlert.driverName,
        todaName: updatedAlert.todaName,
        barangayName: updatedAlert.barangayName,
        plateNo: updatedAlert.plateNo,
        routeName: updatedAlert.routeName,
        ts: new Date(updatedAlert.createdAt).getTime(),
        reason: "Passenger Emergency",
        status: updatedAlert.status,
        lat: updatedAlert.passengerLatitude ?? updatedAlert.passenger_latitude ?? updatedAlert.latitude,
        lng: updatedAlert.passengerLongitude ?? updatedAlert.passenger_longitude ?? updatedAlert.longitude
      }

      setSelectedAlertDetails({ kind: "emergency", item: alertItem, record: updatedAlert })
      setActivePage("live-map")
      focusSelectedAlertOnMap({ kind: "emergency", item: alertItem, record: updatedAlert })

      setActiveEmergencyModal((current) =>
        current?.emergencyId === updatedAlert.emergencyId ? null : current
      )
      setEmergencyQueue((current) =>
        current.filter((item) => item.emergencyId !== updatedAlert.emergencyId)
      )
    } catch (error) {
      setDashboardError(String(error))
    } finally {
      setEmergencyActionBusyId(null)
    }
  }

  const handleEmergencyResolve = async (details: SelectedAlertDetails) => {
    if (details.kind !== "emergency") return
    if (dashboardReadOnly) {
      setDashboardError("Offline mode is read-only. Reconnect to resolve emergencies.")
      return
    }

    setAlertStatusBusy(true)
    try {
      const resolvedAlert = await updateEmergencyAlertStatus(
        accessToken,
        details.record.emergencyId,
        "resolved"
      )
      await refreshDashboardData()
      setSelectedAlertDetails({ kind: "emergency", item: details.item, record: resolvedAlert })
    } catch (error) {
      setDashboardError(String(error))
    } finally {
      setAlertStatusBusy(false)
    }
  }

  const handleViolationStatusChange = async (
    alert: DashboardViolationRecord,
    status: Extract<DashboardViolationRecord["status"], "open" | "under_review" | "resolved">
  ) => {
    if (dashboardReadOnly) {
      setAlertDetailsError("Offline mode is read-only. Reconnect to update alert status.")
      return
    }

    setAlertStatusBusy(true)
    setAlertDetailsError(null)
    try {
      await updateViolationAlertStatus(accessToken, alert.alertSource, alert.violationId, status)
      setDashboardData((current) =>
        current
          ? {
              ...current,
              recentViolations: current.recentViolations.map((item) =>
                item.alertSource === alert.alertSource && item.violationId === alert.violationId
                  ? { ...item, status }
                  : item
              )
            }
          : current
      )
      setSelectedAlertDetails((current) =>
        current?.kind === "violation" &&
        current.record.alertSource === alert.alertSource &&
        current.record.violationId === alert.violationId
          ? {
              ...current,
              record: {
                ...current.record,
                status
              },
              item: {
                ...current.item,
                status
              }
            }
          : current
      )
      await refreshDashboardData()
    } catch (error) {
      setAlertDetailsError(error instanceof Error ? error.message : String(error))
    } finally {
      setAlertStatusBusy(false)
    }
  }

  const focusSelectedAlertOnMap = (details: SelectedAlertDetails) => {
    const record = details.record
    const location = getEmergencyAlertLocation(record)
    if (!location) return

    const lat = location.latitude
    const lng = location.longitude

    const alert: ViolationAlertDetails = {
      key:
        details.kind === "violation"
          ? details.record.violationId
          : `emergency-${details.record.emergencyId}`,
      source:
        details.kind === "violation"
          ? details.record.alertSource
          : "passenger_emergency",
      driverId: record.driverId,
      driverCode: record.driverCode,
      driverName: record.driverName,
      plateNo: record.plateNo,
      tricycleId: record.tricycleId,
      tripId: record.tripId,
      routeName: record.routeName,
      violationType:
        details.kind === "violation"
          ? details.record.violationTypeLabel
          : "Passenger Emergency",
      timestamp:
        details.kind === "violation"
          ? details.record.detectedAt
          : details.record.createdAt,
      locationLabel:
        details.kind === "emergency"
          ? getEmergencyLocationName(details.record)
          : getReadableLocationLabel(details.record.locationLabel),
      description:
        details.kind === "violation"
          ? details.record.description
          : "Passenger triggered the emergency action from the QR web form.",
      lat,
      lng
    }

    const driverLookupToken = alert.driverCode ?? alert.driverId
    const driverRecord = driverLookupToken
      ? getDashboardDriverByIdentifier(driverLookupToken)
      : undefined
    const liveState = driverRecord
      ? driversByIdRef.current[driverRecord.driverCode] ??
        driversByIdRef.current[String(driverRecord.driverId)]
      : undefined
    const driverKey =
      getViolatorDriverKey({
        driverCode: alert.driverCode,
        driverId: alert.driverId
      }) ?? `alert:${alert.key}`
    const nextViolator: MapViolatorRecord = {
      driverKey,
      driverId:
        normalizeDriverToken(alert.driverCode) ??
        (alert.driverId !== undefined ? String(alert.driverId) : "Unknown driver"),
      driverName: alert.driverName ?? alert.driverCode ?? "Unknown driver",
      avatarUrl: alert.profileImageUrl ?? null,
      latitude: lat,
      longitude: lng,
      violationType: alert.violationType,
      timestamp: alert.timestamp,
      status: "active",
      violationId: alert.key,
      source: alert.source,
      locationLabel: alert.locationLabel,
      driverCode: alert.driverCode,
      plateNo: alert.plateNo,
      todaName: record.todaName,
      barangayName: record.barangayName,
      emergencyStatus:
        details.kind === "emergency"
          ? formatEmergencyStatusLabel(details.record.status)
          : undefined,
      tripId: alert.tripId,
      routeName: alert.routeName,
      resolvedAt: null,
      driverOnlineStatus: liveState ? "online" : "offline",
      lastSeenTs: liveState?.lastSeenTs ?? null,
      uiDismissedByAdmin: false,
      driverTokens: buildDriverTokens(alert.driverCode, alert.driverId)
    }

    if (details.kind === "violation") {
      upsertStoredViolator(nextViolator)
    } else {
      upsertLiveViolator(nextViolator)
    }

    setSelectedViolatorKey(driverKey)
    setActivePage("live-map")
    setSelectedAlertDetails(null)

    window.setTimeout(() => {
      const map = mapRef.current
      if (!map) return

      map.resize()
      map.flyTo({
        center: [nextViolator.longitude, nextViolator.latitude],
        zoom: Math.max(map.getZoom(), 16.2),
        essential: true
      })
    }, 80)
  }

  const filteredNotificationItems = useMemo(() => {
    const recencyCutoff = getNotificationRecencyCutoff(notificationRecencyFilter, clockTs)
    const startTs = getDateFilterStartTs(notificationDateFrom)
    const endTs = getDateFilterEndTs(notificationDateTo)

    return notificationItems.filter((item) => {
      if (notificationCategoryFilter !== "all" && item.kind !== notificationCategoryFilter) {
        return false
      }
      if (notificationReadFilter === "unread" && item.isRead) {
        return false
      }
      if (notificationReadFilter === "read" && !item.isRead) {
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
    notificationReadFilter,
    notificationRecencyFilter,
    notificationDateFrom,
    notificationDateTo,
    clockTs
  ])

  const hasNotificationFilters =
    notificationCategoryFilter !== "all" ||
    notificationReadFilter !== "all" ||
    notificationRecencyFilter !== "all" ||
    notificationDateFrom.length > 0 ||
    notificationDateTo.length > 0

  const unreadNotificationCount = useMemo(() => {
    return notificationItems.filter((item) => !item.isRead).length
  }, [notificationItems])

  const markNotificationAsRead = async (notificationKey: string) => {
    const target = notificationItems.find((item) => item.key === notificationKey)
    if (!target || target.isRead) return
    if (offlineViewerMode) return

    setDashboardData((current) =>
      current
        ? {
            ...current,
            notifications: current.notifications.map((item) =>
              item.notificationKey === notificationKey ? { ...item, isRead: true } : item
            ),
            counts: {
              ...current.counts,
              unreadNotifications: Math.max(0, current.counts.unreadNotifications - 1)
            }
          }
        : current
    )

    try {
      await Promise.all([
        markDashboardNotificationsRead(accessToken, [notificationKey]),
        target.kind === "appeal"
          ? markAdminAppealViewed(accessToken, target.sourceEntityId)
          : Promise.resolve()
      ])
    } catch {
      void refreshDashboardData()
    }
  }

  const filteredTripRows = useMemo(() => {
    if (!hasSearchQuery) return tripRows
    return tripRows.filter((trip) => {
      return textMatchesSearch(
        normalizedSearchQuery,
        trip.tripId,
        trip.driverId,
        trip.driverCode,
        trip.driverName,
        trip.tricycleId,
        trip.plateNo,
        trip.routeId,
        trip.routeName,
        trip.todaName,
        trip.barangayName,
        trip.tripStatus,
        getTripDisplayStatus(trip),
        trip.durationMinutes,
        trip.fareAmount,
        trip.distanceKm,
        trip.violationCount,
        trip.hasPath ? "has path" : "no saved path"
      )
    })
  }, [tripRows, hasSearchQuery, normalizedSearchQuery, activeTripIds])

  const homeTripLogSummary = useMemo(() => {
    return filteredTripRows
      .filter((trip) => trip.tripStatus === "completed")
      .sort((a, b) => {
        const aTs = new Date(a.tripEnd ?? a.tripStart).getTime()
        const bTs = new Date(b.tripEnd ?? b.tripStart).getTime()
        return bTs - aTs || b.tripId - a.tripId
      })
      .slice(0, HOME_TRIP_LOG_SUMMARY_LIMIT)
  }, [filteredTripRows])

  const tripLogStats = useMemo(() => {
    const ongoing = tripRows.filter((trip) => getTripDisplayStatus(trip) === "ongoing").length
    const completed = tripRows.filter((trip) => getTripDisplayStatus(trip) === "completed").length
    const incomplete = tripRows.filter((trip) => getTripDisplayStatus(trip) === "incomplete").length

    return {
      total: tripRows.length,
      ongoing,
      completed,
      incomplete
    }
  }, [tripRows, activeTripIds])

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
      return [...BASE_NAV_ITEMS, { key: "superadmin", label: "Settings" }]
    }

    if (adminProfile.role === "toda_admin") {
      return TODA_NAV_ITEMS
    }

    return BASE_NAV_ITEMS
  }, [adminProfile.role])
  const mainNavItems = navItems.filter((item) => item.key !== "superadmin")
  const secondaryNavItems = navItems.filter((item) => item.key === "superadmin")

  const pageLabel = navItems.find((item) => item.key === activePage)?.label ?? "Dashboard"
  const shouldLockPageScroll =
    activePage === "drivers" || activePage === "alerts" || activePage === "trip-logs"
  const headerScope = [adminProfile.barangayName, adminProfile.todaName]
    .filter((item): item is string => Boolean(item))
    .join(" / ")
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
  const dashboardReadOnly = offlineViewerMode || !online
  const dashboardStateLabel = !online
    ? dashboardData
      ? "Offline snapshot"
      : "Offline"
    : dashboardDataSource === "cache"
      ? "Cached snapshot"
      : syncStatus === "connected"
        ? "Live sync"
        : "Syncing"
  const dashboardStateTone = !online
    ? "offline"
    : dashboardDataSource === "cache"
      ? "cached"
      : syncStatus === "connected"
        ? "live"
        : "pending"
  const dashboardSyncSummary = lastDashboardSyncAt
    ? `Last synced: ${formatDateTime(lastDashboardSyncAt)}`
    : "Waiting for first sync"
  const pageSearchPlaceholder =
    childSearchPlaceholder ?? PAGE_SEARCH_PLACEHOLDERS[activePage]

  const openDriverModal = (driver: DriverDirectoryRow) => {
    setSelectedDriverId(driver.driverId)
    setDriverTripHistoryOpen(false)
    setPasswordResetError(null)
    setApprovedTemporaryPassword(null)
  }

  const closeDriverModal = () => {
    setSelectedDriverId(null)
    setDriverTripHistoryOpen(false)
    setPasswordResetError(null)
    setApprovedTemporaryPassword(null)
  }

  const handlePasswordResetDecision = async (
    requestId: number,
    decision: "approve" | "deny"
  ): Promise<boolean> => {
    if (dashboardReadOnly) {
      setPasswordResetError("Offline mode is read-only. Reconnect to approve reset requests.")
      return false
    }

    setPasswordResetBusyId(requestId)
    setPasswordResetError(null)
    setApprovedTemporaryPassword(null)
    try {
      const result = await decideDriverPasswordResetRequest(accessToken, requestId, decision)
      if (result.temporaryPassword) {
        setApprovedTemporaryPassword({
          requestId,
          driverName: result.request.driverName,
          temporaryPassword: result.temporaryPassword,
          expiresAt: result.request.expiresAt,
          pushNotificationSent: result.pushNotificationSent,
          pushNotificationError: result.pushNotificationError
        })
      }
      await refreshDashboardData()
      return true
    } catch (error) {
      setPasswordResetError(error instanceof Error ? error.message : String(error))
      return false
    } finally {
      setPasswordResetBusyId(null)
    }
  }

  const closePasswordResetRequestModal = () => {
    setActivePasswordResetRequest(null)
    setPasswordResetError(null)
    setApprovedTemporaryPassword(null)
  }

  const openPasswordResetDriverDetails = (request: DriverPasswordResetRequestRecord) => {
    shownPasswordResetRequestIdsRef.current.add(request.requestId)
    setActivePasswordResetRequest(null)
    setPasswordResetError(null)
    setApprovedTemporaryPassword(null)
    setSelectedDriverId(request.driverId)
    setDriverTripHistoryOpen(false)
    setActivePage("drivers")
  }

  const openTripPathModal = (trip: DashboardTripRecord) => {
    setSelectedTripForPath(trip)
  }

  const closeTripPathModal = () => {
    setSelectedTripForPath(null)
  }

  const selectedTripViolations = useMemo(() => {
    if (!selectedTripForPath) return []
    return (dashboardData?.recentViolations ?? []).filter(
      (violation) => violation.tripId === selectedTripForPath.tripId
    )
  }, [dashboardData?.recentViolations, selectedTripForPath])

  const selectedTripStartLocationLabel = tripPathLoading
    ? "Loading location name..."
    : getTripLocationName(tripPathData?.startLocationName, "Start location name unavailable")
  const selectedTripEndLocationLabel = tripPathLoading
    ? "Loading location name..."
    : getTripLocationName(tripPathData?.endLocationName, "End location name unavailable")
  const shouldShowMatchedRouteNotice =
    !tripPathLoading && Boolean(tripPathData) && !selectedTripForPath?.hasPath

  useEffect(() => {
    if (!selectedTripForPath) return
    const refreshedTrip = tripRows.find((trip) => trip.tripId === selectedTripForPath.tripId)
    if (refreshedTrip && refreshedTrip !== selectedTripForPath) {
      setSelectedTripForPath(refreshedTrip)
    }
  }, [selectedTripForPath, tripRows])

  const activeViolationDriverLabel =
    activeViolationAlert?.driverName ??
    activeViolationAlert?.driverCode ??
    "Unknown driver"
  const activeViolationInitials =
    activeViolationDriverLabel
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "D"

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <button
          type="button"
          className="sidebar-brand"
          onClick={() => setActivePage("home")}
          aria-label="Go to homepage"
        >
          <img
            src="/triketrack_logo3.png"
            alt="TrikeTrack logo"
            className="sidebar-brand__logo"
          />
          <div className="sidebar-brand__copy">
            <strong>TrikeTrack</strong>
            <span>TODA Monitoring</span>
          </div>
        </button>

        <div className="sidebar-section">
          <div className="sidebar-nav__label">Main</div>
          <nav className="sidebar-nav">
            {mainNavItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`sidebar-nav__item ${
                  item.key === activePage ? "sidebar-nav__item--active" : ""
                }`}
                onClick={() => setActivePage(item.key)}
              >
                <span className="sidebar-nav__item-icon">{renderNavIcon(item.key)}</span>
                <span className="sidebar-nav__item-label">{item.label}</span>
                <span className="sidebar-nav__item-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-section sidebar-section--footer">
          <div className="sidebar-nav__label">Others</div>
          {secondaryNavItems.length > 0 && (
            <nav className="sidebar-nav">
              {secondaryNavItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`sidebar-nav__item ${
                    item.key === activePage ? "sidebar-nav__item--active" : ""
                  }`}
                  onClick={() => setActivePage(item.key)}
                >
                  <span className="sidebar-nav__item-icon">{renderNavIcon(item.key)}</span>
                  <span className="sidebar-nav__item-label">{item.label}</span>
                  <span className="sidebar-nav__item-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
              ))}
            </nav>
          )}

          <button type="button" className="logout-button sidebar-logout" onClick={onLogout}>
            <span className="sidebar-nav__item-icon" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 17 15 12 10 7" />
                <path d="M15 12H4" />
                <path d="M20 20V4" />
              </svg>
            </span>
            <span className="sidebar-nav__item-label">Log out</span>
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar__intro">
            <div className="admin-topbar__crumb">{pageLabel}</div>
            {headerScope && <div className="admin-topbar__sub">{headerScope}</div>}
          </div>

          <div className="admin-topbar__controls">
            <input
              className="topbar-search"
              placeholder={pageSearchPlaceholder}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label={pageSearchPlaceholder.replace("...", "")}
            />
            {activePage !== "superadmin" && activePage !== "toda-admin" && (
              <div className="admin-topbar__status" aria-live="polite">
                <span
                  className={`admin-topbar__status-pill admin-topbar__status-pill--${dashboardStateTone}`}
                >
                  {dashboardStateLabel}
                </span>
                <span className="admin-topbar__status-text">{dashboardSyncSummary}</span>
              </div>
            )}
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
                        Stored alerts, emergencies, appeals, trips, and driver updates shown newest first
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
                      <div
                        className="topbar-notification-menu__count"
                        aria-label={`${unreadNotificationCount} unread notifications`}
                        title="Unread notifications"
                      >
                        {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
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
                        <option value="emergency">Emergencies</option>
                        <option value="appeal">Appeals</option>
                        <option value="password_reset">Password resets</option>
                        <option value="trip">Trips</option>
                        <option value="driver">Drivers</option>
                      </select>

                      <select
                        className="topbar-notification-filter"
                        aria-label="Filter notifications by read status"
                        value={notificationReadFilter}
                        onChange={(event) =>
                          setNotificationReadFilter(event.target.value as NotificationReadFilter)
                        }
                      >
                        <option value="all">Read and unread</option>
                        <option value="unread">Unread only</option>
                        <option value="read">Read only</option>
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
                          setNotificationReadFilter("all")
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
                          className={`topbar-notification-item ${
                            item.isRead
                              ? "topbar-notification-item--read"
                              : "topbar-notification-item--unread"
                          }`}
                          onClick={() => {
                            void markNotificationAsRead(item.key)
                            setActivePage(item.page)
                            if (item.kind === "password_reset") {
                              const request = (dashboardData?.passwordResetRequests ?? []).find(
                                (reset) => String(reset.requestId) === item.sourceEntityId
                              )
                              if (request) {
                                setSelectedDriverId(request.driverId)
                                setDriverTripHistoryOpen(false)
                              }
                            }
                            setNotificationsOpen(false)
                          }}
                        >
                          <span
                            className={`topbar-notification-item__icon topbar-notification-item__icon--${item.tone}`}
                            aria-hidden="true"
                          >
                            {item.kind === "violation"
                              ? "!"
                              : item.kind === "emergency"
                                ? "E"
                                : item.kind === "appeal"
                                  ? "A"
                                  : item.kind === "password_reset"
                                    ? "R"
                                    : item.kind === "trip"
                                      ? "T"
                                      : "D"}
                          </span>
                          <span className="topbar-notification-item__content">
                            <span className="topbar-notification-item__title">
                              {item.title}
                              {!item.isRead && (
                                <span className="topbar-notification-item__state">Unread</span>
                              )}
                              {item.isRead && (
                                <span className="topbar-notification-item__state topbar-notification-item__state--read">
                                  Read
                                </span>
                              )}
                            </span>
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

        <main
          className={`admin-content ${
            activePage === "live-map" ? "admin-content--live-map" : ""
          } ${shouldLockPageScroll ? "admin-content--table-page" : ""}`}
        >
          {(dashboardNotice || dashboardError) &&
            activePage !== "superadmin" &&
            activePage !== "toda-admin" &&
            activePage !== "live-map" && (
            <div
              className={`page-panel dashboard-sync-banner${
                dashboardError ? " dashboard-sync-banner--error" : ""
              }`}
              style={{ padding: "12px 14px", marginBottom: "14px" }}
            >
              <div className="muted">
                {dashboardError
                  ? `Dashboard data sync issue: ${dashboardError}`
                  : dashboardNotice}
              </div>
            </div>
          )}

          {dashboardReadOnly &&
            activePage !== "superadmin" &&
            activePage !== "toda-admin" && (
              <div
                className="page-panel dashboard-sync-banner"
                style={{ padding: "12px 14px", marginBottom: "14px" }}
              >
                <strong>Offline Mode</strong>
                <div className="muted">
                  You are viewing the last saved dashboard data. Live updates and changes will
                  resume when internet connection is restored.
                </div>
              </div>
            )}

          {activePage === "superadmin" && adminProfile.role === "superadmin" && (
            <SuperadminPage
              accessToken={accessToken}
              mode="superadmin"
              searchQuery={searchQuery}
              onSearchPlaceholderChange={setChildSearchPlaceholder}
              onDataChanged={() => void refreshDashboardData()}
            />
          )}

          {activePage === "toda-admin" && adminProfile.role === "toda_admin" && (
            <SuperadminPage
              accessToken={accessToken}
              mode="toda-admin"
              lockedTodaId={adminProfile.todaId}
              lockedTodaLabel={adminProfile.todaName}
              searchQuery={searchQuery}
              onSearchPlaceholderChange={setChildSearchPlaceholder}
              onDataChanged={() => void refreshDashboardData()}
            />
          )}

          {activePage === "home" && (
            <section className="page-stack">
              <div className="overview-grid">
                <article className="overview-card">
                  <div className="overview-card__label">Active Drivers</div>
                  <div className="overview-card__value">{activeDriverCount}</div>
                </article>

                <article className="overview-card">
                  <div className="overview-card__label">Active Alerts</div>
                  <div className="overview-card__value overview-card__value--danger">
                    {(dashboardData?.counts.openAlerts ?? alertRows.length).toString().padStart(2, "0")}
                  </div>
                </article>

                <article className="overview-card">
                  <div className="overview-card__label">Total Trips Today</div>
                  <div className="overview-card__value">{totalTripsToday.toLocaleString()}</div>
                </article>

                <article className="overview-card">
                  <div className="overview-card__label">Ongoing Trips</div>
                  <div className="overview-card__value">{dashboardData?.counts.ongoingTrips ?? 0}</div>
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
                          : "No alerts or emergencies yet."}
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
                          : "No trip records are available yet."}
                      </div>
                    ) : (
                      homeTripLogSummary.map((item) => {
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
              <div className="admin-map" ref={mapEl} />
              {showViolatorOverlay && (
                <ViolatorProfileStack
                  violators={activeViolators}
                  selectedDriverKey={selectedViolatorKey}
                  onSelect={handleViolatorSelect}
                  onDismiss={dismissViolatorProfile}
                />
              )}
              {showViolatorOverlay && selectedViolator && selectedViolationPopupPosition && (
                <ViolationPopup
                  violator={selectedViolator}
                  position={selectedViolationPopupPosition}
                  onClose={() => setSelectedViolatorKey(null)}
                />
              )}
            </section>

            {activePage !== "live-map" ? (
              <aside className="live-map-side">
                <section className="page-panel side-card">
                  <div className="admin-pane__title">Sync Status</div>
                  <div className="meta-grid">
                    <div>Network</div>
                    <div>{online ? "Online" : "Offline"}</div>
                    <div>Data source</div>
                    <div>{dashboardStateLabel}</div>
                    <div>Realtime</div>
                    <div>{syncStatus}</div>
                    <div>Active Drivers</div>
                    <div>{activeDriverCount}</div>
                    <div>Active Tricycles</div>
                    <div>{activeTricycleCount}</div>
                    <div>Ongoing trips</div>
                    <div>{dashboardData?.counts.ongoingTrips ?? 0}</div>
                    <div>Open alerts</div>
                    <div>{dashboardData?.counts.openAlerts ?? alertRows.length}</div>
                    <div>Last data update</div>
                    <div>{lastUpdateTs ? new Date(lastUpdateTs).toLocaleTimeString() : "-"}</div>
                    <div>Last sync</div>
                    <div>{lastDashboardSyncAt ? formatDateTime(lastDashboardSyncAt) : "-"}</div>
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
                        const presence = getDriverPresenceMeta(
                          driver,
                          clockTs,
                          livePresenceHydrated
                        )
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
                            <div className="driver-row__top driver-row__top--profile">
                              <div className="driver-row__identity">
                                {driver.avatarUrl ? (
                                  <img
                                    className="driver-row__avatar"
                                    src={driver.avatarUrl}
                                    alt={`${driver.firstName} ${driver.lastName}`}
                                  />
                                ) : (
                                  <div
                                    className="driver-row__avatar driver-row__avatar--fallback"
                                    aria-hidden="true"
                                  >
                                    {`${driver.firstName.charAt(0)}${driver.lastName.charAt(0)}`
                                      .toUpperCase()
                                      .slice(0, 2)}
                                  </div>
                                )}
                                <strong>{driver.firstName} {driver.lastName}</strong>
                              </div>
                              <span className={presence.className}>{presence.label}</span>
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
                                : driver.operationalState?.activeRouteName
                                  ? `Route ${driver.operationalState.activeRouteName}`
                                  : "Waiting for live GPS point"}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </section>
              </aside>
            ) : null}
          </section>

          {activePage === "drivers" && (
            adminProfile.role === "toda_admin" ? (
              <TodaManagementPage
                accessToken={accessToken}
                page="drivers"
                lockedTodaId={adminProfile.todaId}
                lockedTodaLabel={adminProfile.todaName}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
              onDriverDeleted={(driver) =>
                purgeViolatorProfilesByTokens(buildDriverTokens(driver.driverCode, driver.driverId))
              }
              onDataChanged={() => void refreshDashboardData()}
              readOnly={dashboardReadOnly}
            />
            ) : (
              <section className="page-panel page-panel--table-layout">
                <div className="drivers-table-summary">
                  <article className="drivers-table-summary__card">
                    <span>Total Drivers</span>
                    <strong>{systemDriverStats.total}</strong>
                  </article>
                  <article className="drivers-table-summary__card">
                    <span>Active Drivers</span>
                    <strong>{systemDriverStats.active}</strong>
                  </article>
                  <article className="drivers-table-summary__card">
                    <span>In Transit</span>
                    <strong>{systemDriverStats.inTransit}</strong>
                  </article>
                  <article className="drivers-table-summary__card">
                    <span>Idle Drivers</span>
                    <strong>{systemDriverStats.idle}</strong>
                  </article>
                  <article className="drivers-table-summary__card">
                    <span>Setup Pending</span>
                    <strong>{systemDriverStats.setupPending}</strong>
                  </article>
                  <article className="drivers-table-summary__card">
                    <span>Reset Requests</span>
                    <strong>{systemDriverStats.passwordResetPending}</strong>
                  </article>
                </div>
                <div className="drivers-table-shell">
                  {filteredAllDriverRows.length === 0 ? (
                    <div className="drivers-table-empty">
                      {hasSearchQuery ? `No drivers match "${trimmedSearchQuery}".` : "No drivers yet."}
                    </div>
                  ) : (
                    <div className="drivers-table-wrap">
                      <table className="drivers-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Driver ID</th>
                            <th>Vehicle</th>
                            <th>QR</th>
                            <th>Barangay / TODA</th>
                            <th>Route / Point</th>
                            <th>Last Update</th>
                            <th>Password</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAllDriverRows.map((driver) => {
                            const presence = getDriverPresenceMeta(
                              driver,
                              clockTs,
                              livePresenceHydrated
                            )

                            return (
                              <tr
                                key={driver.driverId}
                                className="drivers-table__row"
                                role="button"
                                tabIndex={0}
                                onClick={() => openDriverModal(driver)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault()
                                    openDriverModal(driver)
                                  }
                                }}
                                aria-label={`View details for ${driver.firstName} ${driver.lastName}`}
                              >
                                <td>
                                  <div className="drivers-table__identity">
                                    {driver.avatarUrl ? (
                                      <img
                                        className="drivers-table__avatar"
                                        src={driver.avatarUrl}
                                        alt={`${driver.firstName} ${driver.lastName}`}
                                      />
                                    ) : (
                                      <div
                                        className="drivers-table__avatar drivers-table__avatar--fallback"
                                        aria-hidden="true"
                                      >
                                        {`${driver.firstName.charAt(0)}${driver.lastName.charAt(0)}`
                                          .toUpperCase()
                                          .slice(0, 2)}
                                      </div>
                                    )}
                                    <div className="drivers-table__identity-text">
                                      <strong>{driver.firstName} {driver.lastName}</strong>
                                      <span>{driver.contactNo ?? "No contact provided"}</span>
                                    </div>
                                  </div>
                                </td>
                                <td>{driver.driverCode}</td>
                                <td>{driver.tricycleNo ? `Tricycle ${driver.tricycleNo}` : "Unassigned"}</td>
                                <td>{driver.qrId ? `#${driver.qrId}` : "Not assigned"}</td>
                                <td>
                                  <div className="drivers-table__stack">
                                    <strong>{driver.barangayName}</strong>
                                    <span>{driver.todaName}</span>
                                  </div>
                                </td>
                                <td>
                                  <div className="drivers-table__stack">
                                    <strong>
                                      {driver.operationalState?.activeRouteName
                                        ? `Route ${driver.operationalState.activeRouteName}`
                                        : "No active route"}
                                    </strong>
                                    <span>
                                      {driver.liveState
                                        ? formatPoint(driver.liveState.latestPoint)
                                        : "Waiting for live GPS point"}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  {driver.liveState
                                    ? formatLastSeen(driver.liveState.lastSeenTs, clockTs)
                                    : driver.operationalState?.lastUpdateAt
                                      ? formatDateTime(driver.operationalState.lastUpdateAt)
                                      : "No live point yet"}
                                </td>
                                <td>
                                  <span className="drivers-table__pill">
                                    {driver.passwordSet ? "Set" : "Pending"}
                                  </span>
                                </td>
                                <td>
                                  <span className={presence.className}>{presence.label}</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )
          )}

          {selectedDriver && !driverTripHistoryOpen && (
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
                  <div className="driver-modal__profile">
                    {selectedDriver.avatarUrl ? (
                      <img
                        className="driver-modal__avatar"
                        src={selectedDriver.avatarUrl}
                        alt={`${selectedDriver.firstName} ${selectedDriver.lastName}`}
                      />
                    ) : (
                      <div className="driver-modal__avatar driver-modal__avatar--fallback" aria-hidden="true">
                        {`${selectedDriver.firstName.charAt(0)}${selectedDriver.lastName.charAt(0)}`
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <h3 id="driver-modal-title">
                        {selectedDriver.firstName} {selectedDriver.lastName}
                      </h3>
                      <p>{selectedDriver.driverCode}</p>
                    </div>
                  </div>
                  <div className="driver-modal__header-actions">
                    <button
                      type="button"
                      className="driver-modal__primary"
                      onClick={() => setDriverTripHistoryOpen(true)}
                    >
                      Trip History
                    </button>
                    <button type="button" className="driver-modal__close" onClick={closeDriverModal}>
                      Close
                    </button>
                  </div>
                </div>

                <div className="driver-modal__body">
                  <section className="driver-modal__contact-strip" aria-label="Driver quick details">
                    <div>
                      <span className="driver-modal__label">Contact</span>
                      <strong>{selectedDriver.contactNo ?? "No contact provided"}</strong>
                    </div>
                    <div>
                      <span className="driver-modal__label">Barangay</span>
                      <strong>{selectedDriver.barangayName}</strong>
                    </div>
                    <div>
                      <span className="driver-modal__label">TODA</span>
                      <strong>{selectedDriver.todaName}</strong>
                    </div>
                    <div>
                      <span className="driver-modal__label">Last Active</span>
                      <strong>
                        {selectedDriver.liveState
                          ? formatLastSeen(selectedDriver.liveState.lastSeenTs, clockTs)
                          : "No live point yet"}
                      </strong>
                    </div>
                  </section>

                  <section className="driver-modal__section">
                    <div className="driver-modal__section-head">
                      <h4>General Information</h4>
                    </div>
                    <div className="driver-modal__info-grid">
                      <div>
                        <span className="driver-modal__label">Driver Status</span>
                        <strong>
                          {getDriverPresenceMeta(
                            selectedDriver,
                            clockTs,
                            livePresenceHydrated
                          ).label}
                        </strong>
                      </div>
                      <div>
                        <span className="driver-modal__label">Password</span>
                        <strong>{selectedDriver.passwordSet ? "Set" : "Pending"}</strong>
                      </div>
                      <div>
                        <span className="driver-modal__label">Created</span>
                        <strong>{formatDateTime(selectedDriver.createdAt)}</strong>
                      </div>
                      <div>
                        <span className="driver-modal__label">Recent Trips</span>
                        <strong>{selectedDriverTripRows.length}</strong>
                      </div>
                    </div>
                  </section>

                  <section className="driver-modal__section">
                    <div className="driver-modal__section-head">
                      <h4>Password Reset Requests</h4>
                      <p>Approve only after verifying the driver's identity.</p>
                    </div>

                    {passwordResetError && (
                      <div className="emergency-modal__error" role="alert">
                        {passwordResetError}
                      </div>
                    )}

                    {approvedTemporaryPassword && (
                      <div className="driver-password-reset__temp" role="status">
                        <span>Temporary reset password for {approvedTemporaryPassword.driverName}</span>
                        <strong>{approvedTemporaryPassword.temporaryPassword}</strong>
                        <small>
                          {approvedTemporaryPassword.pushNotificationSent
                            ? "A push notification with this one-time code was sent to the verified driver."
                            : `Push notification was not delivered${approvedTemporaryPassword.pushNotificationError ? `: ${approvedTemporaryPassword.pushNotificationError}` : "."} Share this one-time code with the verified driver.`}{" "}
                          It expires
                          {approvedTemporaryPassword.expiresAt
                            ? ` at ${formatDateTime(approvedTemporaryPassword.expiresAt)}.`
                            : " soon."}
                        </small>
                      </div>
                    )}

                    {selectedDriverPasswordResetRequests.length === 0 ? (
                      <div className="driver-modal__empty">
                        No password reset request has been submitted by this driver.
                      </div>
                    ) : (
                      <div className="driver-password-reset-list">
                        {selectedDriverPasswordResetRequests.map((request) => (
                          <article key={request.requestId} className="driver-password-reset-card">
                            <div>
                              <strong>Request #{request.requestId}</strong>
                              <span>{formatDateTime(request.requestedAt)}</span>
                            </div>
                            <span className={`drivers-table__pill driver-password-reset-card__status--${request.status}`}>
                              {request.status.replace("_", " ")}
                            </span>
                            {request.status === "pending" ? (
                              <div className="driver-password-reset-card__actions">
                                <button
                                  type="button"
                                  className="driver-modal__primary"
                                  disabled={passwordResetBusyId === request.requestId || dashboardReadOnly}
                                  onClick={() => void handlePasswordResetDecision(request.requestId, "approve")}
                                >
                                  {passwordResetBusyId === request.requestId ? "Approving..." : "Approve reset"}
                                </button>
                                <button
                                  type="button"
                                  className="driver-modal__secondary"
                                  disabled={passwordResetBusyId === request.requestId || dashboardReadOnly}
                                  onClick={() => void handlePasswordResetDecision(request.requestId, "deny")}
                                >
                                  Deny
                                </button>
                              </div>
                            ) : (
                              <small>
                                {request.expiresAt ? `Expires ${formatDateTime(request.expiresAt)}` : "No active temporary password"}
                              </small>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="driver-modal__section">
                    <div className="driver-modal__section-head">
                      <h4>Assignment Information</h4>
                    </div>
                    <div className="driver-modal__info-grid">
                      <div>
                        <span className="driver-modal__label">Assigned Tricycle</span>
                        <strong>
                          {selectedDriver.tricycleNo
                            ? `Tricycle ${selectedDriver.tricycleNo}`
                            : "No tricycle assigned"}
                        </strong>
                      </div>
                      <div>
                        <span className="driver-modal__label">QR</span>
                        <strong>{selectedDriver.qrId ? `#${selectedDriver.qrId}` : "Not assigned"}</strong>
                      </div>
                      <div>
                        <span className="driver-modal__label">Current Route / Point</span>
                        <strong>
                          {selectedDriver.liveState
                            ? formatPoint(selectedDriver.liveState.latestPoint)
                            : selectedDriver.operationalState?.activeRouteName
                              ? `Route ${selectedDriver.operationalState.activeRouteName}`
                              : "Waiting for live GPS point"}
                        </strong>
                      </div>
                      <div>
                        <span className="driver-modal__label">Operational State</span>
                        <strong>
                          {selectedDriver.operationalState?.operationalStatus
                            ? selectedDriver.operationalState.operationalStatus.replace("_", " ")
                            : "No active operation"}
                        </strong>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}

          {selectedDriver && driverTripHistoryOpen && (
            <div
              className="driver-modal-backdrop driver-modal-backdrop--stacked"
              role="presentation"
            >
              <div
                className="driver-modal driver-modal--history"
                role="dialog"
                aria-modal="true"
                aria-labelledby="driver-trip-history-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="driver-modal__header">
                  <div>
                    <h3 id="driver-trip-history-title">Trip History</h3>
                    <p>
                      {selectedDriver.firstName} {selectedDriver.lastName} | {selectedDriver.driverCode}
                    </p>
                  </div>
                  <div className="driver-modal__header-actions">
                    <button
                      type="button"
                      className="driver-modal__secondary"
                      onClick={() => setDriverTripHistoryOpen(false)}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="driver-modal__close"
                      onClick={closeDriverModal}
                    >
                      Close
                    </button>
                  </div>
                </div>
                <div className="driver-modal__body">
                  <section className="driver-modal__section">
                    <div className="driver-modal__section-head">
                      <h4>Recent Trips</h4>
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
                                <span>Distance</span>
                                <strong>{trip.distanceKm !== undefined ? `${trip.distanceKm.toFixed(2)} km` : "-"}</strong>
                              </div>
                              <div>
                                <span>Fare</span>
                                <strong>{trip.fareAmount !== undefined ? `PHP ${trip.fareAmount.toFixed(2)}` : "-"}</strong>
                              </div>
                              <div>
                                <span>Alerts</span>
                                <strong>{trip.violationCount}</strong>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="trip-path-button"
                              onClick={() => openTripPathModal(trip)}
                              disabled={!trip.hasPath}
                            >
                              {trip.hasPath ? "View Trip Path" : "No saved path"}
                            </button>
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
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onDataChanged={() => void refreshDashboardData()}
              readOnly={dashboardReadOnly}
            />
          )}

          {activePage === "alerts" && (
            <section className="page-panel page-panel--table-layout">
              <div className="dashboard-table-summary">
                <article className="dashboard-table-summary__card">
                  <span>Total Alerts</span>
                  <strong>{alertStats.total}</strong>
                </article>
                <article className="dashboard-table-summary__card">
                  <span>Open Alerts</span>
                  <strong>{alertStats.open}</strong>
                </article>
                <article className="dashboard-table-summary__card">
                  <span>Emergencies</span>
                  <strong>{alertStats.emergency}</strong>
                </article>
                <article className="dashboard-table-summary__card">
                  <span>Resolved</span>
                  <strong>{alertStats.resolved}</strong>
                </article>
              </div>
              <div className="dashboard-table-shell">
                {filteredAlerts.length === 0 ? (
                  <div className="dashboard-table-empty">
                    {hasSearchQuery
                      ? `No alerts match "${trimmedSearchQuery}".`
                      : "No alerts or emergencies yet."}
                  </div>
                ) : (
                  <div className="dashboard-table-wrap">
                    <table className="dashboard-data-table">
                      <thead>
                        <tr>
                          <th>Driver</th>
                          <th>Type</th>
                          <th>Reason</th>
                          <th>Plate / Route</th>
                          <th>Location</th>
                          <th>Scope</th>
                          <th>Time</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAlerts.map((alert) => (
                          <tr
                            key={alert.key}
                            className="dashboard-data-table__row--clickable"
                            tabIndex={0}
                            role="button"
                            onClick={() => openAlertDetails(alert)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                openAlertDetails(alert)
                              }
                            }}
                          >
                            <td>{alert.driverName ?? `Driver ${alert.driverId}`}</td>
                            <td>{alert.source === "emergency" ? "Emergency" : "Alert"}</td>
                            <td>{alert.reason}</td>
                            <td>{[alert.plateNo, alert.routeName].filter(Boolean).join(" / ") || "-"}</td>
                            <td>
                              {alert.description
                                ? getReadableLocationLabel(alert.description)
                                : "Location name unavailable"}
                            </td>
                            <td>{[alert.barangayName, alert.todaName].filter(Boolean).join(" / ") || "-"}</td>
                            <td>{new Date(alert.ts).toLocaleString()}</td>
                            <td>
                              <span className={`drivers-table__pill drivers-table__pill--status`}>
                                {alert.source === "emergency"
                                  ? formatAlertStatusLabel(alert.status ?? "created")
                                  : formatAlertStatusLabel(alert.status ?? "open")}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
            )}

          {activePage === "reports" && (
            <ReportsPage
              accessToken={accessToken}
              initialSection={reportsPageSection}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onSearchPlaceholderChange={setChildSearchPlaceholder}
              onDataChanged={() => void refreshDashboardData()}
              readOnly={dashboardReadOnly}
            />
          )}

          {activePage === "trip-logs" && (
            <section className="page-panel page-panel--table-layout">
              <div className="dashboard-table-summary">
                <article className="dashboard-table-summary__card">
                  <span>Total Trips</span>
                  <strong>{tripLogStats.total}</strong>
                </article>
                <article className="dashboard-table-summary__card">
                  <span>Ongoing</span>
                  <strong>{tripLogStats.ongoing}</strong>
                </article>
                <article className="dashboard-table-summary__card">
                  <span>Completed</span>
                  <strong>{tripLogStats.completed}</strong>
                </article>
                <article className="dashboard-table-summary__card">
                  <span>Incomplete</span>
                  <strong>{tripLogStats.incomplete}</strong>
                </article>
              </div>
              <div className="dashboard-table-shell">
                {filteredTripRows.length === 0 ? (
                  <div className="dashboard-table-empty">
                    {hasSearchQuery
                      ? `No trip logs match "${trimmedSearchQuery}".`
                      : "No stored trips yet."}
                  </div>
                ) : (
                  <div className="dashboard-table-wrap">
                    <table className="dashboard-data-table">
                      <thead>
                        <tr>
                          <th>Trip</th>
                          <th>Driver</th>
                          <th>Plate</th>
                          <th>Route</th>
                          <th>Start</th>
                          <th>End</th>
                          <th>Fare</th>
                          <th>Duration</th>
                          <th>Distance</th>
                          <th>Path</th>
                          <th>Alerts</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTripRows.map((trip) => {
                          const tripDisplayStatus = getTripDisplayStatus(trip)
                          return (
                          <tr
                            key={trip.tripId}
                            className="dashboard-data-table__row--clickable"
                            tabIndex={0}
                            onClick={() => openTripPathModal(trip)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                openTripPathModal(trip)
                              }
                            }}
                          >
                            <td>{trip.tripId}</td>
                            <td>{trip.driverName}</td>
                            <td>{trip.plateNo}</td>
                            <td>{trip.routeName}</td>
                            <td>{new Date(trip.tripStart).toLocaleString()}</td>
                            <td>{trip.tripEnd ? new Date(trip.tripEnd).toLocaleString() : "-"}</td>
                            <td>{trip.fareAmount !== undefined ? `PHP ${trip.fareAmount.toFixed(2)}` : "-"}</td>
                            <td>{trip.durationMinutes !== undefined ? `${trip.durationMinutes} min` : "-"}</td>
                            <td>{trip.distanceKm !== undefined ? `${trip.distanceKm.toFixed(2)} km` : "-"}</td>
                            <td>
                              <button
                                type="button"
                                className="table-action-button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openTripPathModal(trip)
                                }}
                                disabled={!trip.hasPath}
                              >
                                {trip.hasPath ? `${trip.pathPointCount ?? 0} pts` : "None"}
                              </button>
                            </td>
                            <td>{trip.violationCount}</td>
                            <td>
                              <span className={`drivers-table__pill drivers-table__pill--status trip-status-pill trip-status-pill--${tripDisplayStatus}`}>
                                {formatTripDisplayStatus(tripDisplayStatus)}
                              </span>
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
        {selectedTripForPath && (
          <div
            className="trip-path-modal-backdrop"
            role="presentation"
            onClick={closeTripPathModal}
          >
            <section
              className="trip-path-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="trip-path-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="trip-path-modal__header">
                <div>
                  <h2 id="trip-path-modal-title">
                    Trip #{selectedTripForPath.tripId} Details
                  </h2>
                  <p>
                    {selectedTripForPath.driverName} | {selectedTripForPath.plateNo} |{" "}
                    {selectedTripForPath.routeName}
                  </p>
                </div>
                <button
                  type="button"
                  className="trip-path-modal__close"
                  onClick={closeTripPathModal}
                >
                  Close
                </button>
              </div>

              <div className="trip-path-modal__body">
                <div className="trip-path-modal__meta">
                  <div>
                    <span>Trip ID</span>
                    <strong>{selectedTripForPath.tripId}</strong>
                  </div>
                  <div>
                    <span>Driver</span>
                    <strong>{selectedTripForPath.driverName}</strong>
                  </div>
                  <div>
                    <span>Driver Code</span>
                    <strong>{selectedTripForPath.driverCode}</strong>
                  </div>
                  <div>
                    <span>Plate Number</span>
                    <strong>{selectedTripForPath.plateNo}</strong>
                  </div>
                  <div>
                    <span>Route</span>
                    <strong>{selectedTripForPath.routeName}</strong>
                  </div>
                  <div>
                    <span>Trip Status</span>
                    <strong>{formatTripDisplayStatus(getTripDisplayStatus(selectedTripForPath))}</strong>
                  </div>
                  <div>
                    <span>Start</span>
                    <strong>{formatDateTime(selectedTripForPath.tripStart)}</strong>
                  </div>
                  <div>
                    <span>End</span>
                    <strong>{formatDateTime(selectedTripForPath.tripEnd)}</strong>
                  </div>
                  <div>
                    <span>Fare</span>
                    <strong>
                      {selectedTripForPath.fareAmount !== undefined
                        ? `PHP ${selectedTripForPath.fareAmount.toFixed(2)}`
                        : "-"}
                    </strong>
                  </div>
                  <div>
                    <span>Duration</span>
                    <strong>
                      {selectedTripForPath.durationMinutes !== undefined
                        ? `${selectedTripForPath.durationMinutes} min`
                        : "-"}
                    </strong>
                  </div>
                  <div>
                    <span>Distance</span>
                    <strong>
                      {selectedTripForPath.distanceKm !== undefined
                        ? `${selectedTripForPath.distanceKm.toFixed(2)} km`
                        : "-"}
                    </strong>
                  </div>
                  <div>
                    <span>Raw gps</span>
                    <strong>{tripPathData?.rawPointCount ?? selectedTripForPath.pathPointCount ?? "-"}</strong>
                  </div>
                  <div>
                    <span>Alert Count</span>
                    <strong>{selectedTripForPath.violationCount}</strong>
                  </div>
                  <div>
                    <span>Start Location</span>
                    <strong>{selectedTripStartLocationLabel}</strong>
                  </div>
                  <div>
                    <span>End Location</span>
                    <strong>{selectedTripEndLocationLabel}</strong>
                  </div>
                </div>

                <section className="trip-path-modal__section">
                  <div className="trip-path-modal__section-head">
                    <h3>Completed Trip Map Preview</h3>
                    <span>{tripPathData?.rawPointCount ?? selectedTripForPath.pathPointCount ?? 0} points</span>
                  </div>

                  {tripPathError && (
                    <div className="trip-path-modal__notice" role="status">
                      {tripPathError.replace(/^Error:\s*/, "")}
                    </div>
                  )}

                  {shouldShowMatchedRouteNotice && (
                    <div className="trip-path-modal__notice" role="status">
                      Matched route is not available yet. Showing the stored GPS route.
                    </div>
                  )}

                  {tripPathLoading ? (
                    <div className="trip-path-modal__empty">Loading matched trip route...</div>
                  ) : tripPathData ? (
                    <TripPathMap tripPath={tripPathData} violations={selectedTripViolations} />
                  ) : (
                    <div className="trip-path-modal__empty">
                      Matched route is not available yet.
                    </div>
                  )}
                </section>

                {selectedTripViolations.length > 0 && (
                  <section className="trip-path-modal__section">
                    <div className="trip-path-modal__section-head">
                      <h3>Linked Violations</h3>
                      <span>{selectedTripViolations.length} linked</span>
                    </div>
                    <div className="trip-path-modal__violations">
                      {selectedTripViolations.map((violation) => (
                        <article key={`${violation.alertSource}-${violation.violationId}`}>
                          <strong>{violation.violationTypeLabel}</strong>
                          <span>{formatDateTime(violation.detectedAt)}</span>
                          <p>
                            {[
                              removeCoordinateText(violation.description),
                              getReadableLocationLabel(violation.locationLabel, "")
                            ]
                              .filter(Boolean)
                              .join(" | ") || "No additional violation details."}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </section>
          </div>
        )}
        {activeViolationAlert && (
          <div
            className="violation-modal-backdrop"
            role="presentation"
            onClick={closeViolationAlert}
          >
            <section
              className="violation-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-violation-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="violation-modal__header">
                <div className="violation-modal__title-row">
                  <div className="violation-modal__badge" aria-hidden="true">!</div>
                  <div>
                    <h2 id="admin-violation-modal-title">Violation Alert</h2>
                    <p>New driver violation detected</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="violation-modal__close"
                  onClick={closeViolationAlert}
                  aria-label="Dismiss violation alert"
              >
                Close
              </button>
              </div>

              <div className="violation-modal__body">
                {violationAlertQueue.length > 0 && (
                  <div className="violation-modal__queue">
                    {violationAlertQueue.length} more violation
                    {violationAlertQueue.length === 1 ? " is" : "s are"} waiting.
                  </div>
                )}

                <div className="violation-modal__driver">
                  <div className="violation-modal__avatar" aria-hidden="true">
                    {activeViolationAlert.profileImageUrl ? (
                      <img src={activeViolationAlert.profileImageUrl} alt="" />
                    ) : (
                      activeViolationInitials
                    )}
                  </div>
                  <div className="violation-modal__driver-copy">
                    <strong>{activeViolationDriverLabel}</strong>
                    <span>{activeViolationAlert.driverCode ?? "No driver code"}</span>
                  </div>
                </div>

                <div className="violation-modal__details">
                  <div>
                    <span>Plate Number</span>
                    <strong>{activeViolationAlert.plateNo ?? "Not available"}</strong>
                  </div>
                  <div>
                    <span>Tricycle Number</span>
                    <strong>
                      {activeViolationAlert.tricycleNo ??
                        (activeViolationAlert.tricycleId
                          ? `Tricycle #${activeViolationAlert.tricycleId}`
                          : "Not available")}
                    </strong>
                  </div>
                  <div>
                    <span>Trip ID</span>
                    <strong>
                      {activeViolationAlert.tripId
                        ? `TRIP-${String(activeViolationAlert.tripId).replace(/^TRIP-/i, "")}`
                        : "No active trip"}
                    </strong>
                  </div>
                  <div>
                    <span>Violation Type</span>
                    <strong>{activeViolationAlert.violationType}</strong>
                  </div>
                  <div>
                    <span>Timestamp</span>
                    <strong>{formatDateTime(activeViolationAlert.timestamp)}</strong>
                  </div>
                  <div>
                    <span>Current Location</span>
                    <strong>
                      {getReadableLocationLabel(activeViolationAlert.locationLabel)}
                    </strong>
                  </div>
                  <div>
                    <span>Route</span>
                    <strong>{activeViolationAlert.routeName ?? "No route context"}</strong>
                  </div>
                </div>

                {activeViolationAlert.description && (
                  <p className="violation-modal__description">
                    {removeCoordinateText(activeViolationAlert.description)}
                  </p>
                )}

                <div className="violation-modal__actions">
                  <button
                    type="button"
                    className="violation-modal__button violation-modal__button--secondary"
                    onClick={closeViolationAlert}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    className="violation-modal__button violation-modal__button--primary"
                    onClick={() => focusViolationOnMap(activeViolationAlert)}
                    disabled={!hasViolationCoordinates(activeViolationAlert)}
                  >
                    View Map
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
        {selectedAlertDetails && (
          <div
            className="alert-detail-modal-backdrop"
            role="presentation"
            onClick={() => setSelectedAlertDetails(null)}
          >
            <section
              className="alert-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="alert-detail-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="alert-detail-modal__header">
                <div>
                  <span className="alert-detail-modal__badge">
                    {selectedAlertDetails.kind === "emergency"
                      ? "Passenger Emergency"
                      : selectedAlertDetails.record.violationTypeLabel}
                  </span>
                  <h2 id="alert-detail-modal-title">
                    {selectedAlertDetails.record.driverName ??
                      selectedAlertDetails.record.driverCode ??
                      "Alert details"}
                  </h2>
                  <p>
                    {[selectedAlertDetails.record.plateNo, selectedAlertDetails.record.routeName]
                      .filter(Boolean)
                      .join(" / ") || "No plate or route context"}
                  </p>
                </div>
                <button
                  type="button"
                  className="violation-modal__close"
                  onClick={() => setSelectedAlertDetails(null)}
                >
                  Close
                </button>
              </div>

              <div className="alert-detail-modal__body">
                <div className="alert-detail-modal__grid">
                  <div>
                    <span>Driver</span>
                    <strong>
                      {selectedAlertDetails.record.driverName ??
                        selectedAlertDetails.record.driverCode ??
                        "Unassigned driver"}
                    </strong>
                  </div>
                  <div>
                    <span>Driver Code</span>
                    <strong>{selectedAlertDetails.record.driverCode ?? "-"}</strong>
                  </div>
                  <div>
                    <span>Driver ID</span>
                    <strong>{selectedAlertDetails.record.driverId ?? "-"}</strong>
                  </div>
                  <div>
                    <span>Plate Number</span>
                    <strong>{selectedAlertDetails.record.plateNo ?? "-"}</strong>
                  </div>
                  <div>
                    <span>TODA / Barangay</span>
                    <strong>
                      {[selectedAlertDetails.record.todaName, selectedAlertDetails.record.barangayName]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </strong>
                  </div>
                  {selectedAlertDetails.record.routeName ? (
                    <div>
                      <span>Route</span>
                      <strong>{selectedAlertDetails.record.routeName}</strong>
                    </div>
                  ) : null}
                  <div>
                    <span>
                      {selectedAlertDetails.kind === "emergency"
                        ? "Passenger Location"
                        : "Location"}
                    </span>
                    <strong>
                      {selectedAlertDetails.kind === "emergency"
                        ? getEmergencyLocationName(selectedAlertDetails.record)
                        : getReadableLocationLabel(selectedAlertDetails.record.locationLabel)}
                    </strong>
                  </div>
                  <div>
                    <span>Time reported</span>
                    <strong>
                      {selectedAlertDetails.kind === "emergency"
                        ? new Date(selectedAlertDetails.record.createdAt).toLocaleString()
                        : new Date(selectedAlertDetails.record.detectedAt).toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>
                      {selectedAlertDetails.kind === "emergency"
                        ? formatEmergencyStatusLabel(selectedAlertDetails.record.status)
                        : selectedAlertDetails.record.status}
                    </strong>
                  </div>
                  <div>
                    <span>Report reason</span>
                    <strong>
                      {selectedAlertDetails.kind === "emergency"
                        ? "Passenger Emergency"
                        : selectedAlertDetails.record.violationTypeLabel}
                    </strong>
                  </div>
                  {selectedAlertTrip ? (
                    <div>
                      <span>Trip</span>
                      <strong>
                        #{selectedAlertTrip.tripId} {selectedAlertTrip.tripStatus}
                      </strong>
                    </div>
                  ) : null}
                </div>

                {selectedAlertDetails.kind === "violation" &&
                  isGeofenceBoundaryViolation(selectedAlertDetails.record) && (
                    <label className="alert-detail-modal__status">
                      <span>Violation Status</span>
                      <select
                        value={selectedAlertDetails.record.status}
                        disabled={alertStatusBusy || dashboardReadOnly}
                        onChange={(event) =>
                          void handleViolationStatusChange(
                            selectedAlertDetails.record,
                            event.target.value as Extract<
                              DashboardViolationRecord["status"],
                              "open" | "under_review" | "resolved"
                            >
                          )
                        }
                      >
                        <option value="open">Take Action</option>
                        <option value="under_review">Under Review</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </label>
                  )}

                {alertDetailsError && (
                  <div className="emergency-modal__error" role="alert">
                    {alertDetailsError}
                  </div>
                )}

                {selectedAlertLocation ? (
                  <div className="alert-detail-modal__map">
                    <div className="alert-detail-modal__map-header">Passenger location</div>
                    <iframe
                      title="Passenger location map preview"
                      loading="lazy"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedAlertLocation.longitude - 0.004}%2C${selectedAlertLocation.latitude - 0.004}%2C${selectedAlertLocation.longitude + 0.004}%2C${selectedAlertLocation.latitude + 0.004}&layer=mapnik&marker=${selectedAlertLocation.latitude}%2C${selectedAlertLocation.longitude}`}
                    />
                  </div>
                ) : (
                  <div style={{padding: '12px', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '13px', borderLeft: '4px solid #ffc107'}}>
                    <strong>Passenger location was not captured.</strong><br/>
                    Latitude and longitude are missing from this emergency request.
                  </div>
                )}

                <div className="violation-modal__actions">
                  <button
                    type="button"
                    className="violation-modal__button violation-modal__button--secondary"
                    onClick={() => setSelectedAlertDetails(null)}
                  >
                    Close
                  </button>
                  {selectedAlertDetails.kind === "emergency" && (
                    <button
                      type="button"
                      className="violation-modal__button"
                      disabled={alertStatusBusy || dashboardReadOnly}
                      onClick={() => void handleEmergencyResolve(selectedAlertDetails)}
                    >
                      {alertStatusBusy ? "Resolving..." : "Mark as Resolved"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="violation-modal__button violation-modal__button--primary"
                    disabled={!selectedAlertLocation}
                    onClick={() => focusSelectedAlertOnMap(selectedAlertDetails)}
                  >
                    View on Live Map
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
        {activePasswordResetRequest && (
          <div className="password-reset-modal-backdrop" role="presentation">
            <section
              className="password-reset-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-password-reset-modal-title"
            >
              <div className="password-reset-modal__header">
                <span className="password-reset-modal__badge">Password Reset Request</span>
                <button
                  type="button"
                  className="password-reset-modal__close"
                  onClick={closePasswordResetRequestModal}
                  aria-label="Close password reset request"
                >
                  x
                </button>
              </div>

              <div className="password-reset-modal__body">
                <h2 id="admin-password-reset-modal-title">
                  Driver needs password reset approval
                </h2>
                <p>
                  Verify the driver before approving. Approval generates a one-time temporary
                  password and sends it to the driver for use on the Login screen.
                </p>

                <div className="password-reset-modal__details">
                  <div>
                    <span>Driver</span>
                    <strong>{activePasswordResetRequest.driverName}</strong>
                  </div>
                  <div>
                    <span>Driver Code</span>
                    <strong>{activePasswordResetRequest.driverCode}</strong>
                  </div>
                  <div>
                    <span>TODA</span>
                    <strong>{activePasswordResetRequest.todaName}</strong>
                  </div>
                  <div>
                    <span>Requested</span>
                    <strong>{formatDateTime(activePasswordResetRequest.requestedAt)}</strong>
                  </div>
                </div>

                {passwordResetError && (
                  <div className="password-reset-modal__error" role="alert">
                    {passwordResetError}
                  </div>
                )}

                {approvedTemporaryPassword?.requestId ===
                  activePasswordResetRequest.requestId && (
                  <div className="password-reset-modal__temp" role="status">
                    <span>Temporary reset password</span>
                    <strong>{approvedTemporaryPassword.temporaryPassword}</strong>
                    <small>
                      {approvedTemporaryPassword.pushNotificationSent
                        ? "A push notification with this one-time code was sent to the verified driver."
                        : `Push notification was not delivered${approvedTemporaryPassword.pushNotificationError ? `: ${approvedTemporaryPassword.pushNotificationError}` : "."} Share this one-time code with the verified driver.`}{" "}
                      It expires
                      {approvedTemporaryPassword.expiresAt
                        ? ` at ${formatDateTime(approvedTemporaryPassword.expiresAt)}.`
                        : " soon."}
                    </small>
                  </div>
                )}
              </div>

              <div className="password-reset-modal__actions">
                {approvedTemporaryPassword?.requestId ===
                activePasswordResetRequest.requestId ? (
                  <button
                    type="button"
                    className="password-reset-modal__primary"
                    onClick={closePasswordResetRequestModal}
                  >
                    Done
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="password-reset-modal__secondary"
                      onClick={() => openPasswordResetDriverDetails(activePasswordResetRequest)}
                    >
                      View Driver
                    </button>
                    <button
                      type="button"
                      className="password-reset-modal__danger"
                      disabled={
                        passwordResetBusyId === activePasswordResetRequest.requestId ||
                        dashboardReadOnly
                      }
                      onClick={async () => {
                        const updated = await handlePasswordResetDecision(
                          activePasswordResetRequest.requestId,
                          "deny"
                        )
                        if (updated) setActivePasswordResetRequest(null)
                      }}
                    >
                      {passwordResetBusyId === activePasswordResetRequest.requestId
                        ? "Denying..."
                        : "Deny"}
                    </button>
                    <button
                      type="button"
                      className="password-reset-modal__primary"
                      disabled={
                        passwordResetBusyId === activePasswordResetRequest.requestId ||
                        dashboardReadOnly
                      }
                      onClick={() =>
                        void handlePasswordResetDecision(
                          activePasswordResetRequest.requestId,
                          "approve"
                        )
                      }
                    >
                      {passwordResetBusyId === activePasswordResetRequest.requestId
                        ? "Approving..."
                        : "Approve Reset"}
                    </button>
                  </>
                )}
              </div>
            </section>
          </div>
        )}
        {activeEmergencyModal && (
          <div className="emergency-modal-backdrop" role="presentation">
            <section
              className="emergency-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-emergency-modal-title"
            >
              <div className="emergency-modal__header">
                <div className="emergency-modal__badge">Passenger Emergency</div>
                <h2 id="admin-emergency-modal-title">Immediate attention required</h2>
                <p className="emergency-modal__message">
                  A passenger triggered the emergency action from the QR reporting page.
                </p>
                {emergencyQueue.length > 0 && (
                  <p className="emergency-modal__message">
                    {emergencyQueue.length} more emergency
                    {emergencyQueue.length === 1 ? " is" : "ies are"} waiting in the queue.
                  </p>
                )}
              </div>

              <div className="emergency-modal__body">
                <div className="emergency-modal__details">
                  <div>
                    <span>Driver</span>
                    <strong>{activeEmergencyModal.driverName}</strong>
                  </div>
                  <div>
                    <span>Plate / Unit</span>
                    <strong>{activeEmergencyModal.plateNo ?? "No tricycle assigned"}</strong>
                  </div>
                  <div>
                    <span>Time</span>
                    <strong>{new Date(activeEmergencyModal.createdAt).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Route</span>
                    <strong>{activeEmergencyModal.routeName ?? "No route context"}</strong>
                  </div>
                  <div>
                    <span>Passenger Location</span>
                    <strong>{getEmergencyLocationName(activeEmergencyModal)}</strong>
                  </div>
                </div>

                <div className="emergency-modal__meta">
                  {[activeEmergencyModal.barangayName, activeEmergencyModal.todaName, activeEmergencyModal.status]
                    .filter(Boolean)
                    .join(" | ")}
                </div>

                {activeEmergencyLocation ? (
                  <div className="emergency-modal__map">
                    <div className="emergency-modal__map-header">Passenger location</div>
                    <iframe
                      title="Passenger emergency location preview"
                      loading="lazy"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${activeEmergencyLocation.longitude - 0.004}%2C${activeEmergencyLocation.latitude - 0.004}%2C${activeEmergencyLocation.longitude + 0.004}%2C${activeEmergencyLocation.latitude + 0.004}&layer=mapnik&marker=${activeEmergencyLocation.latitude}%2C${activeEmergencyLocation.longitude}`}
                    />
                  </div>
                ) : null}

                {dashboardError && (
                  <div className="emergency-modal__error" role="alert">
                    {dashboardError.replace(/^Error:\s*/, "")}
                  </div>
                )}

                <div className="emergency-modal__actions">
                  <button
                    type="button"
                    className="emergency-modal__button"
                    disabled={emergencyActionBusyId === activeEmergencyModal.emergencyId}
                    onClick={() => void handleEmergencyResponse(activeEmergencyModal)}
                  >
                    {emergencyActionBusyId === activeEmergencyModal.emergencyId
                      ? "Confirming..."
                      : "Confirm Response"}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
