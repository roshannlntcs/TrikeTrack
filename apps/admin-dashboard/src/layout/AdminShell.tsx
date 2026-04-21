import { useEffect, useMemo, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import * as turf from "@turf/turf"
import type { GeoJSON as MapGeoJSON } from "../types/geojson"
import type { DriverLocationEvent } from "../lib/shared-types"
import type { AdminProfile } from "../lib/admin-profile"
import { markAdminAppealViewed } from "../lib/reports"
import {
  fetchDashboardData,
  type DashboardDataSnapshot,
  type DashboardDriverRecord,
  type DashboardEmergencyRecord,
  type DashboardOperationalDriverRecord,
  type DashboardTripRecord,
  type DashboardViolationRecord,
  type TripPathRecord,
  fetchTripPath,
  markDashboardNotificationsRead
} from "../lib/dashboard-data"
import {
  connectAdminEmergencyStream,
  updateEmergencyAlertStatus
} from "../lib/emergencies"
import geofenceRaw from "../data/geofence.geojson?raw"
import { supabase } from "../lib/supabase"
import ReportsPage from "../components/ReportsPage"
import SuperadminPage from "../superadmin/SuperadminPage"
import TodaManagementPage from "../toda/TodaManagementPage"
import {
  MAP_STYLE_OPTIONS,
  createRasterStyle,
  type TriketrackMapStyleId
} from "../../../../common/maps"
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
type AdminMapLocation = {
  latitude: number
  longitude: number
  accuracy?: number
  heading?: number | null
  timestamp?: number
}

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

const formatPoint = (point: DriverLocationEvent) =>
  `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`

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

const getGeolocationErrorMessage = (error: GeolocationPositionError) => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location access was denied."
    case error.POSITION_UNAVAILABLE:
      return "Current location is unavailable."
    case error.TIMEOUT:
      return "Location request timed out."
    default:
      return "Unable to get the current location."
  }
}

const createAdminCurrentLocationMarker = () => {
  const markerEl = document.createElement("div")
  markerEl.className = "admin-map-current-location-marker"
  markerEl.setAttribute("aria-label", "Current location")
  return markerEl
}

const LocateMeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 3.75v3m0 10.5v3m8.25-8.25h-3M6.75 12h-3m12.45 0a5.2 5.2 0 1 1-10.4 0 5.2 5.2 0 0 1 10.4 0Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
)

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

function TripPathMap({ tripPath }: { tripPath: TripPathRecord }) {
  const mapRootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!mapRootRef.current) return

    const coordinates = getTripPathCoordinates(tripPath.pathGeojson)
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

      const bounds = new maplibregl.LngLatBounds()
      for (const coordinate of coordinates) {
        bounds.extend(coordinate)
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
    })

    return () => {
      map.remove()
    }
  }, [tripPath])

  return <div className="trip-path-map" ref={mapRootRef} />
}

const hasViolationCoordinates = (
  alert: Pick<ViolationAlertDetails, "lat" | "lng">
): alert is Pick<ViolationAlertDetails, "lat" | "lng"> & { lat: number; lng: number } =>
  typeof alert.lat === "number" &&
  Number.isFinite(alert.lat) &&
  typeof alert.lng === "number" &&
  Number.isFinite(alert.lng)

const formatViolationCoordinates = (
  alert: Pick<ViolationAlertDetails, "lat" | "lng">
) => (hasViolationCoordinates(alert) ? `${alert.lat.toFixed(6)}, ${alert.lng.toFixed(6)}` : undefined)

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

type DriverDirectoryRow = DashboardDriverRecord & {
  liveState?: DriverStreamState
  operationalState?: DashboardOperationalDriverRecord
}

const isDriverOnlineNow = (
  driver: DriverDirectoryRow,
  nowTs: number,
  livePresenceHydrated: boolean
) => {
  if (driver.status !== "active") return false

  if (livePresenceHydrated) {
    return Boolean(driver.liveState && isFreshPresence(driver.liveState.lastSeenTs, nowTs))
  }

  return Boolean(driver.liveState) || driver.operationalState?.isOnline === true
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

type AlertListItem = {
  key: string
  source: "violation" | "emergency"
  emergencyId?: number
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

type ViolationAlertDetails = {
  key: string
  source: "live_geofence" | DashboardViolationRecord["alertSource"]
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
  kind: "violation" | "trip" | "driver" | "emergency" | "appeal"
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
  driverId: String(alert.driverId ?? "N/A"),
  driverName: alert.driverName ?? alert.driverCode,
  todaName: alert.todaName,
  barangayName: alert.barangayName,
  plateNo: alert.plateNo,
  routeName: alert.routeName,
  ts: new Date(alert.detectedAt).getTime(),
  reason: alert.violationTypeLabel,
  description: alert.locationLabel
    ? [alert.locationLabel, alert.description].filter(Boolean).join(" | ")
    : alert.description,
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
    alert.locationLabel,
    alert.routeName
  ]
    .filter(Boolean)
    .join(" | "),
  status: alert.status,
  lat: alert.latitude,
  lng: alert.longitude
})

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
  accessToken
}: AdminShellProps) {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const geofenceBoundsRef = useRef<[[number, number], [number, number]] | null>(null)
  const ensureGeofenceLayersRef = useRef<((fitToBounds?: boolean) => void) | null>(null)
  const appliedMapStyleRef = useRef<TriketrackMapStyleId>("street")
  const violationFocusMarkerRef = useRef<maplibregl.Marker | null>(null)
  const currentLocationMarkerRef = useRef<maplibregl.Marker | null>(null)
  const [activePage, setActivePage] = useState<NavKey>(
    adminProfile.role === "superadmin"
      ? "superadmin"
      : "home"
  )
  const [selectedMapStyle, setSelectedMapStyle] = useState<TriketrackMapStyleId>("street")
  const [currentMapLocation, setCurrentMapLocation] = useState<AdminMapLocation | null>(null)
  const [mapLocationError, setMapLocationError] = useState<string | null>(null)
  const [isLocatingMap, setIsLocatingMap] = useState(false)

  const [syncStatus, setSyncStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting")
  const [lastUpdateTs, setLastUpdateTs] = useState<number | null>(null)
  const [online, setOnline] = useState<boolean>(navigator.onLine)
  const [driversById, setDriversById] = useState<Record<string, DriverStreamState>>(
    {}
  )
  const driversByIdRef = useRef<Record<string, DriverStreamState>>({})
  const [dashboardData, setDashboardData] = useState<DashboardDataSnapshot | null>(null)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [clockTs, setClockTs] = useState<number>(Date.now())
  const [searchQuery, setSearchQuery] = useState<string>("")
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
  const [activeViolationAlert, setActiveViolationAlert] =
    useState<ViolationAlertDetails | null>(null)
  const [violationAlertQueue, setViolationAlertQueue] = useState<ViolationAlertDetails[]>([])
  const dashboardDataRef = useRef<DashboardDataSnapshot | null>(null)
  const dashboardRefreshInFlightRef = useRef<Promise<void> | null>(null)
  const dashboardRefreshQueuedRef = useRef(false)
  const visibleDriverIdentifiersRef = useRef<Set<string>>(new Set())
  const dashboardDriversRef = useRef<DashboardDriverRecord[]>([])
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
    setActivePage("live-map")
    closeViolationAlert()

    window.setTimeout(() => {
      const map = mapRef.current
      if (!map || !hasViolationCoordinates(alert)) return

      map.resize()
      map.flyTo({
        center: [alert.lng, alert.lat],
        zoom: Math.max(map.getZoom(), 16),
        essential: true
      })

      violationFocusMarkerRef.current?.remove()
      const markerEl = document.createElement("div")
      markerEl.className = "violation-map-focus-marker"
      markerEl.setAttribute("aria-label", "Violation location")
      violationFocusMarkerRef.current = new maplibregl.Marker({ element: markerEl })
        .setLngLat([alert.lng, alert.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 16 }).setText(
            `${alert.violationType} | ${alert.driverName ?? alert.driverCode ?? "Unknown driver"}`
          )
        )
        .addTo(map)
    }, 80)
  }

  const refreshDashboardData = async () => {
    if (dashboardRefreshInFlightRef.current) {
      dashboardRefreshQueuedRef.current = true
      return dashboardRefreshInFlightRef.current
    }

    const runRefresh = async () => {
      try {
        const snapshot = await fetchDashboardData(accessToken)
        setDashboardData(snapshot)
        setDashboardError(
          snapshot.cacheMeta
            ? `Showing cached dashboard data from ${formatDateTime(snapshot.cacheMeta.savedAt)}.`
            : null
        )
      } catch (error) {
        setDashboardError(String(error))
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
    let active = true

    void (async () => {
      try {
        const snapshot = await fetchDashboardData(accessToken)
        if (!active) return
        setDashboardData(snapshot)
        setDashboardError(
          snapshot.cacheMeta
            ? `Showing cached dashboard data from ${formatDateTime(snapshot.cacheMeta.savedAt)}.`
            : null
        )
      } catch (error) {
        if (!active) return
        setDashboardError(String(error))
      }
    })()

    return () => {
      active = false
      dashboardRefreshInFlightRef.current = null
      dashboardRefreshQueuedRef.current = false
    }
  }, [accessToken])

  useEffect(() => {
    driversByIdRef.current = driversById
  }, [driversById])

  useEffect(() => {
    dashboardDataRef.current = dashboardData
  }, [dashboardData])

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
  }, [accessToken, selectedTripForPath])

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setMapLocationError("Geolocation is not supported on this device.")
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentMapLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading:
            typeof position.coords.heading === "number" && Number.isFinite(position.coords.heading)
              ? position.coords.heading
              : null,
          timestamp: position.timestamp
        })
        setMapLocationError(null)
        setIsLocatingMap(false)
      },
      (error) => {
        setMapLocationError(getGeolocationErrorMessage(error))
        setIsLocatingMap(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000
      }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

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

    const markers = new Map<string, maplibregl.Marker>()
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

    map.on("style.load", () => {
      ensureGeofenceLayers(false)
    })

    map.on("idle", () => {
      ensureGeofenceLayers(false)
    })

    map.on("load", () => {
      ensureGeofenceLayers(true)

      const updateMarker = (event: DriverLocationEvent, inside: boolean) => {
        const existing = markers.get(event.driverId)
        if (existing) {
          existing.setLngLat([event.lng, event.lat])
          const markerEl = existing.getElement() as HTMLDivElement
          markerEl.title = getDriverLabel(event.driverId)
          renderMarkerFrameContent(markerEl, event.driverId)
          applyMarkerTone(markerEl, inside)
          existing.getPopup()?.setDOMContent(createDriverPopupContent(event.driverId))
          return
        }
        const markerEl = createMarkerElement(event.driverId, inside)
        const marker = new maplibregl.Marker({ element: markerEl })
          .setLngLat([event.lng, event.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 12 }).setDOMContent(
              createDriverPopupContent(event.driverId)
            )
          )
          .addTo(map)
        markers.set(event.driverId, marker)
      }

      const handleLocationEvent = (event: DriverLocationEvent) => {
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
        const hasActiveTrip =
          activeTripId !== undefined ||
          operationalState?.operationalStatus === "on_trip" ||
          trip?.tripStatus === "ongoing"
        updateMarker(event, inside)
        upsertDriverState(event, !inside && hasActiveTrip)

        const previousInside = driverInsideStateRef.current[event.driverId]
        driverInsideStateRef.current[event.driverId] = inside
        if (inside || previousInside === false || !hasActiveTrip) return

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
          locationLabel: formatViolationCoordinates({ lat: event.lat, lng: event.lng }),
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
        const identifiers = [row.driver_code.trim().toUpperCase(), String(row.driver_id)]
        if (!isLiveLocationRowOnline(row)) {
          removeDriverLivePresence(identifiers)
          return
        }

        const locationEvent = toLocationEventFromRow(row)
        if (!isDriverVisibleToAdmin(locationEvent.driverId)) {
          removeDriverLivePresence(identifiers)
          return
        }
        handleLocationEvent(locationEvent)
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
          removeDriverLivePresence(staleIdentifiers)
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
              if (payload.eventType === "DELETE") {
                removeDriverLivePresence([
                  row.driver_code.trim().toUpperCase(),
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
      window.addEventListener("online", handleOnlineState)
      window.addEventListener("offline", handleOnlineState)
      void loadLiveDriverLocations()
      connectRealtime()
      stalePresenceTimer = window.setInterval(() => {
        const nowTs = Date.now()
        const staleIdentifiers = Object.entries(driversByIdRef.current)
          .filter(([, driverState]) => !isFreshPresence(driverState.lastSeenTs, nowTs))
          .map(([driverIdentifier]) => driverIdentifier)

        if (staleIdentifiers.length > 0) {
          removeDriverLivePresence(staleIdentifiers)
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
      for (const marker of markers.values()) {
        marker.remove()
      }
      currentLocationMarkerRef.current?.remove()
      currentLocationMarkerRef.current = null
      violationFocusMarkerRef.current?.remove()
      violationFocusMarkerRef.current = null
      map.remove()
      mapRef.current = null
      geofenceBoundsRef.current = null
    }
  }, [accessToken, adminProfile.adminId, adminProfile.role])

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
    if (!map || !currentMapLocation) return

    const lngLat: [number, number] = [
      currentMapLocation.longitude,
      currentMapLocation.latitude
    ]

    if (!currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current = new maplibregl.Marker({
        element: createAdminCurrentLocationMarker()
      })
        .setLngLat(lngLat)
        .setPopup(new maplibregl.Popup({ offset: 16 }).setText("Your current location"))
        .addTo(map)
      return
    }

    currentLocationMarkerRef.current.setLngLat(lngLat)
  }, [currentMapLocation])

  const handleLocateMap = () => {
    if (!("geolocation" in navigator)) {
      setMapLocationError("Geolocation is not supported on this device.")
      return
    }

    setIsLocatingMap(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading:
            typeof position.coords.heading === "number" && Number.isFinite(position.coords.heading)
              ? position.coords.heading
              : null,
          timestamp: position.timestamp
        }
        setCurrentMapLocation(nextLocation)
        setMapLocationError(null)
        setIsLocatingMap(false)
        mapRef.current?.flyTo({
          center: [nextLocation.longitude, nextLocation.latitude],
          zoom: Math.max(mapRef.current.getZoom(), 15.5),
          essential: true
        })
      },
      (error) => {
        setMapLocationError(getGeolocationErrorMessage(error))
        setIsLocatingMap(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    )
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
      setupPending: setupPendingCount
    }
  }, [activeDriverCount, clockTs, driverDirectoryRows, livePresenceHydrated])

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
    return [
      ...(dashboardData?.recentEmergencies ?? []).map(createStoredEmergencyAlertListItem),
      ...(dashboardData?.recentViolations ?? []).map(createStoredAlertListItem)
    ]
      .sort((a, b) => b.ts - a.ts)
  }, [dashboardData?.recentEmergencies, dashboardData?.recentViolations])

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
        (alert.plateNo?.toLowerCase().includes(normalizedSearchQuery) ?? false) ||
        (alert.routeName?.toLowerCase().includes(normalizedSearchQuery) ?? false) ||
        point.toLowerCase().includes(normalizedSearchQuery)
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
      const coordinates = formatViolationCoordinates({ lat, lng })

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
        locationLabel: violation.locationLabel ?? coordinates,
        description: violation.description,
        lat,
        lng
      })
      shownViolationPopupKeysRef.current.add(violationKey)
    }
  }, [dashboardData?.recentViolations, dashboardData?.drivers, dashboardData?.operationalDrivers, dashboardData?.recentTrips])

  useEffect(() => {
    const closeStream = connectAdminEmergencyStream(accessToken, {
      onSnapshot: (items) => {
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
  }, [accessToken])

  useEffect(() => {
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
  }, [accessToken])

  const handleEmergencyResponse = async (alert: DashboardEmergencyRecord) => {
    setEmergencyActionBusyId(alert.emergencyId)
    try {
      await updateEmergencyAlertStatus(accessToken, alert.emergencyId, "responding")
      await refreshDashboardData()
      setActiveEmergencyModal((current) =>
        current?.emergencyId === alert.emergencyId ? null : current
      )
      setEmergencyQueue((current) =>
        current.filter((item) => item.emergencyId !== alert.emergencyId)
      )
    } catch (error) {
      setDashboardError(String(error))
    } finally {
      setEmergencyActionBusyId(null)
    }
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
    const ongoing = tripRows.filter((trip) => trip.tripStatus === "ongoing").length
    const completed = tripRows.filter((trip) => trip.tripStatus === "completed").length
    const cancelled = tripRows.filter((trip) => trip.tripStatus === "cancelled").length

    return {
      total: tripRows.length,
      ongoing,
      completed,
      cancelled
    }
  }, [tripRows])

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

  const openDriverModal = (driver: DriverDirectoryRow) => {
    setSelectedDriverId(driver.driverId)
    setDriverTripHistoryOpen(false)
  }

  const closeDriverModal = () => {
    setSelectedDriverId(null)
    setDriverTripHistoryOpen(false)
  }

  const openTripPathModal = (trip: DashboardTripRecord) => {
    setSelectedTripForPath(trip)
  }

  const closeTripPathModal = () => {
    setSelectedTripForPath(null)
  }

  const activeViolationCoordinates = activeViolationAlert
    ? formatViolationCoordinates(activeViolationAlert)
    : undefined
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
          {dashboardError &&
            activePage !== "superadmin" &&
            activePage !== "toda-admin" &&
            activePage !== "live-map" && (
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
              <div className="admin-map-toolbar">
                <div className="admin-map-style-switcher" role="tablist" aria-label="Map style">
                  {MAP_STYLE_OPTIONS.map((styleOption) => {
                    const active = selectedMapStyle === styleOption.id
                    return (
                      <button
                        key={styleOption.id}
                        type="button"
                        className={`admin-map-style-switcher__button ${
                          active ? "admin-map-style-switcher__button--active" : ""
                        }`}
                        onClick={() => setSelectedMapStyle(styleOption.id)}
                        role="tab"
                        aria-selected={active}
                      >
                        {styleOption.label}
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  className="admin-map-locate-button"
                  onClick={handleLocateMap}
                  aria-label="Center map on current location"
                >
                  <LocateMeIcon />
                  <span>{isLocatingMap ? "Locating..." : "Locate me"}</span>
                </button>
              </div>
              <div className="admin-map" ref={mapEl} />
              {mapLocationError && (
                <div className="admin-map-status admin-map-status--error">{mapLocationError}</div>
              )}
            </section>

            {activePage !== "live-map" ? (
              <aside className="live-map-side">
                <section className="page-panel side-card">
                  <div className="admin-pane__title">Sync Status</div>
                  <div className="meta-grid">
                    <div>Network</div>
                    <div>{online ? "Online" : "Offline"}</div>
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
                onDataChanged={() => void refreshDashboardData()}
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

                  <div className="driver-modal__tabs" aria-label="Driver detail sections">
                    <span className="driver-modal__tab driver-modal__tab--active">Personal</span>
                    <button
                      type="button"
                      className="driver-modal__tab"
                      onClick={() => setDriverTripHistoryOpen(true)}
                    >
                      Trip History
                    </button>
                  </div>

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
              onClick={() => setDriverTripHistoryOpen(false)}
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
                  <button
                    type="button"
                    className="driver-modal__close"
                    onClick={() => setDriverTripHistoryOpen(false)}
                  >
                    Close
                  </button>
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
              onDataChanged={() => void refreshDashboardData()}
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
                          <tr key={alert.key}>
                            <td>{alert.driverName ?? `Driver ${alert.driverId}`}</td>
                            <td>{alert.source === "emergency" ? "Emergency" : "Alert"}</td>
                            <td>{alert.reason}</td>
                            <td>{[alert.plateNo, alert.routeName].filter(Boolean).join(" / ") || "-"}</td>
                            <td>
                              {alert.lat !== undefined && alert.lng !== undefined
                                ? `${alert.lat.toFixed(5)}, ${alert.lng.toFixed(5)}`
                                : alert.description ?? "-"}
                            </td>
                            <td>{[alert.barangayName, alert.todaName].filter(Boolean).join(" / ") || "-"}</td>
                            <td>{new Date(alert.ts).toLocaleString()}</td>
                            <td>
                              <span className={`drivers-table__pill drivers-table__pill--status`}>
                                {alert.status ?? (alert.source === "emergency" ? "created" : "open")}
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
              onDataChanged={() => void refreshDashboardData()}
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
                  <span>Cancelled</span>
                  <strong>{tripLogStats.cancelled}</strong>
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
                        {filteredTripRows.map((trip) => (
                          <tr key={trip.tripId}>
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
                                onClick={() => openTripPathModal(trip)}
                                disabled={!trip.hasPath}
                              >
                                {trip.hasPath ? `${trip.pathPointCount ?? 0} pts` : "None"}
                              </button>
                            </td>
                            <td>{trip.violationCount}</td>
                            <td>
                              <span className="drivers-table__pill drivers-table__pill--status">
                                {trip.tripStatus}
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
                    Trip #{selectedTripForPath.tripId} Path
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

              <div className="trip-path-modal__meta">
                <div>
                  <span>Start</span>
                  <strong>{formatDateTime(selectedTripForPath.tripStart)}</strong>
                </div>
                <div>
                  <span>End</span>
                  <strong>{formatDateTime(selectedTripForPath.tripEnd)}</strong>
                </div>
                <div>
                  <span>Points</span>
                  <strong>{tripPathData?.pointCount ?? selectedTripForPath.pathPointCount ?? "-"}</strong>
                </div>
                <div>
                  <span>Alerts</span>
                  <strong>{selectedTripForPath.violationCount}</strong>
                </div>
              </div>

              {tripPathError && (
                <div className="trip-path-modal__notice" role="status">
                  {tripPathError.replace(/^Error:\s*/, "")}
                </div>
              )}

              {tripPathLoading ? (
                <div className="trip-path-modal__empty">Loading saved trip path...</div>
              ) : tripPathData ? (
                <TripPathMap tripPath={tripPathData} />
              ) : (
                <div className="trip-path-modal__empty">
                  No saved path is available for this trip yet.
                </div>
              )}
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
                <div>
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
                    {activeViolationAlert.locationLabel ??
                      activeViolationCoordinates ??
                      "Location not available"}
                  </strong>
                </div>
                <div>
                  <span>Coordinates</span>
                  <strong>{activeViolationCoordinates ?? "Not available"}</strong>
                </div>
                <div>
                  <span>Route</span>
                  <strong>{activeViolationAlert.routeName ?? "No route context"}</strong>
                </div>
              </div>

              {activeViolationAlert.description && (
                <p className="violation-modal__description">
                  {activeViolationAlert.description}
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
              </div>

              <div className="emergency-modal__meta">
                {[activeEmergencyModal.barangayName, activeEmergencyModal.todaName, activeEmergencyModal.status]
                  .filter(Boolean)
                  .join(" | ")}
              </div>

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
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
