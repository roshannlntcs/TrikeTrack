import { useEffect, useMemo, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import * as turf from "@turf/turf"
import type { GeoJSON as RouteGeoJSON } from "../types/geojson"
import type { DriverLocationEvent, ViolationEvent } from "../../../../common/types"
import routeRaw from "../data/route.geojson?raw"
import { enqueueViolation, getOutboxCount, savePoint } from "../lib/db"
import { syncOutbox } from "../lib/outbox"
import "./AdminShell.css"

type DriverStreamState = {
  driverId: string
  lastSeenTs: number
  latestPoint: DriverLocationEvent
  violationCount: number
  recentPoints: DriverLocationEvent[]
}

type ActivityItem = {
  id: string
  title: string
  subtitle: string
  ts: number
  variant: "ok" | "alert"
}

type NavKey = "home" | "live-map" | "drivers" | "alerts" | "trip-logs"

type NavItem = {
  key: NavKey
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Home" },
  { key: "live-map", label: "Live Map" },
  { key: "drivers", label: "Drivers" },
  { key: "alerts", label: "Alerts" },
  { key: "trip-logs", label: "Trip Logs" }
]

const ROUTE_ID = "obrero-agdao"
const GEOFENCE_RADIUS_METERS = 1200
const DRIVER_OFFLINE_MS = 15000
const VIOLATION_DEDUP_MS = 60000
const RECENT_POINTS_PER_DRIVER = 8
const MAX_ALERTS = 40
const OUTBOX_SYNC_MS = 5000
const MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
const REGISTERED_DRIVERS = 60

const toDriverLocationEvent = (
  payload: unknown
): DriverLocationEvent | null => {
  if (!payload || typeof payload !== "object") return null
  const raw = payload as Record<string, unknown>
  const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value)
  const isString = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0

  if (raw.type !== "driver_location") return null
  if (!isString(raw.driverId)) return null
  if (!isFiniteNumber(raw.ts)) return null
  if (!isFiniteNumber(raw.lng) || !isFiniteNumber(raw.lat)) return null
  if (raw.speed !== undefined && !isFiniteNumber(raw.speed)) return null
  if (raw.heading !== undefined && !isFiniteNumber(raw.heading)) return null
  if (raw.accuracy !== undefined && !isFiniteNumber(raw.accuracy)) return null
  if (raw.tripId !== undefined && !isString(raw.tripId)) return null

  return {
    type: "driver_location",
    driverId: raw.driverId,
    ts: raw.ts,
    lng: raw.lng,
    lat: raw.lat,
    speed: raw.speed,
    heading: raw.heading,
    accuracy: raw.accuracy,
    tripId: raw.tripId
  }
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

type AdminShellProps = {
  onLogout: () => void
}

export default function AdminShell({ onLogout }: AdminShellProps) {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [activePage, setActivePage] = useState<NavKey>("live-map")

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
  const [clockTs, setClockTs] = useState<number>(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setClockTs(Date.now()), 3000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!mapEl.current) return

    const route = JSON.parse(routeRaw) as RouteGeoJSON
    const VIOLATION_SYNC_ENDPOINT =
      import.meta.env.VITE_VIOLATIONS_ENDPOINT || "/api/violations/batch"

    const map = new maplibregl.Map({
      container: mapEl.current,
      style: MAP_STYLE_URL,
      center: [125.4553, 7.1907],
      zoom: 13,
      maxZoom: 19
    })
    mapRef.current = map

    map.on("error", (error) => {
      console.error("MapLibre error:", (error as any)?.error || error)
    })

    let reconnectTimer: number | undefined
    let socket: WebSocket | null = null
    let active = true
    let onlineHandler: (() => void) | null = null
    let outboxTimer: number | undefined
    let outboxOnlineHandler: (() => void) | null = null

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

    const createMarkerElement = (color: string) => {
      const markerEl = document.createElement("div")
      markerEl.style.width = "14px"
      markerEl.style.height = "14px"
      markerEl.style.borderRadius = "50%"
      markerEl.style.background = color
      markerEl.style.border = "2px solid #ffffff"
      markerEl.style.boxShadow = "0 2px 6px rgba(0,0,0,0.35)"
      return markerEl
    }

    const upsertDriverState = (event: DriverLocationEvent, isViolation: boolean) => {
      setDriversById((previous) => {
        const existing = previous[event.driverId]
        const updatedRecent = [event, ...(existing?.recentPoints ?? [])].slice(
          0,
          RECENT_POINTS_PER_DRIVER
        )
        return {
          ...previous,
          [event.driverId]: {
            driverId: event.driverId,
            lastSeenTs: Math.max(existing?.lastSeenTs ?? 0, event.ts),
            latestPoint: event,
            violationCount: (existing?.violationCount ?? 0) + (isViolation ? 1 : 0),
            recentPoints: updatedRecent
          }
        }
      })
    }

    map.on("load", () => {
      const routeFeature = (route as any).features?.[0]
      if (!routeFeature) {
        console.error("route.geojson has no features[0]. Add a LineString feature.")
        return
      }

      const coords = routeFeature.geometry?.coordinates as number[][]
      if (!Array.isArray(coords) || coords.length < 2) {
        console.error("route.geojson LineString must have at least 2 coordinates.")
        return
      }

      const routeBounds = new maplibregl.LngLatBounds()
      for (const [lng, lat] of coords) {
        routeBounds.extend([lng, lat])
      }
      map.fitBounds(routeBounds, {
        padding: { top: 40, right: 40, bottom: 40, left: 40 },
        maxZoom: 17,
        duration: 0
      })

      const panBounds = turf.bbox(
        turf.buffer(routeFeature, 800, { units: "meters" }) as any
      )
      map.setMaxBounds([
        [panBounds[0], panBounds[1]],
        [panBounds[2], panBounds[3]]
      ])

      map.addSource("route", { type: "geojson", data: route as any })
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#ff2d2d",
          "line-width": 6,
          "line-opacity": 0.9
        }
      })

      const geofenceCenter = turf.center(routeFeature)
      const geofenceCircle = turf.circle(geofenceCenter, GEOFENCE_RADIUS_METERS, {
        units: "meters",
        steps: 72
      })
      map.addSource("area-geofence", {
        type: "geojson",
        data: geofenceCircle as any
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

      const corridor = turf.buffer(routeFeature, 30, { units: "meters" })
      map.addSource("corridor", { type: "geojson", data: corridor as any })
      map.addLayer({
        id: "corridor-fill",
        type: "fill",
        source: "corridor",
        paint: {
          "fill-color": "#22c55e",
          "fill-opacity": 0.2
        }
      })

      const updateMarker = (event: DriverLocationEvent, inside: boolean) => {
        const color = inside ? "#2563eb" : "#ef4444"
        const existing = markers.get(event.driverId)
        if (existing) {
          existing.setLngLat([event.lng, event.lat])
          existing.getElement().style.background = color
          return
        }
        const markerEl = createMarkerElement(color)
        const marker = new maplibregl.Marker({ element: markerEl })
          .setLngLat([event.lng, event.lat])
          .setPopup(new maplibregl.Popup({ offset: 12 }).setText(event.driverId))
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

      const handleLocationEvent = async (event: DriverLocationEvent) => {
        const inside = turf.booleanPointInPolygon(
          turf.point([event.lng, event.lat]),
          corridor as any
        )
        const isViolation = !inside

        updateMarker(event, inside)
        upsertDriverState(event, isViolation)

        if (isViolation) {
          await enqueueViolationEvent(event)
        }

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

      const WS_URL =
        import.meta.env.VITE_WS_URL ||
        `${window.location.protocol === "https:" ? "wss" : "ws"}://${
          window.location.host
        }/ws`
      console.log("WS URL:", import.meta.env.VITE_WS_URL)

      const connectSocket = () => {
        if (!active) return
        if (socket && socket.readyState === WebSocket.OPEN) return
        if (socket && socket.readyState === WebSocket.CONNECTING) return

        setSyncStatus("connecting")
        socket = new WebSocket(WS_URL)

        socket.onopen = () => {
          console.log("ADMIN WS connected")
          setSyncStatus("connected")
        }

        socket.onmessage = (messageEvent) => {
          console.log("ADMIN WS message", messageEvent.data)
          if (!active) return
          try {
            const payload = JSON.parse(messageEvent.data as string) as unknown
            const locationEvent = toDriverLocationEvent(payload)
            if (!locationEvent) {
              console.warn("Rejected WS payload: invalid DriverLocationEvent")
              return
            }
            void handleLocationEvent(locationEvent).then(() => {
              if (active) setLastUpdateTs(Date.now())
            })
          } catch (error) {
            console.warn("WS payload error:", error)
          }
        }

        socket.onerror = (errorEvent) => {
          console.log("ADMIN WS error", errorEvent)
          setSyncStatus("disconnected")
        }

        socket.onclose = () => {
          console.log("ADMIN WS closed")
          setSyncStatus("disconnected")
          if (reconnectTimer) window.clearTimeout(reconnectTimer)
          if (navigator.onLine) {
            reconnectTimer = window.setTimeout(connectSocket, 3000)
          }
        }
      }

      const handleOnlineState = () => {
        const isOnline = navigator.onLine
        setOnline(isOnline)
        if (isOnline) {
          connectSocket()
        } else {
          setSyncStatus("disconnected")
          setOutboxStatus("offline")
        }
      }

      onlineHandler = handleOnlineState
      window.addEventListener("online", handleOnlineState)
      window.addEventListener("offline", handleOnlineState)
      connectSocket()
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

    return () => {
      active = false
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      if (socket) socket.close()
      if (onlineHandler) {
        window.removeEventListener("online", onlineHandler)
        window.removeEventListener("offline", onlineHandler)
      }
      if (outboxTimer) window.clearInterval(outboxTimer)
      if (outboxOnlineHandler) {
        window.removeEventListener("online", outboxOnlineHandler)
        window.removeEventListener("offline", outboxOnlineHandler)
      }
      for (const marker of markers.values()) {
        marker.remove()
      }
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (activePage === "live-map" && mapRef.current) {
      window.setTimeout(() => {
        mapRef.current?.resize()
      }, 0)
    }
  }, [activePage])

  const driverRows = useMemo(() => {
    return Object.values(driversById).sort((a, b) => b.lastSeenTs - a.lastSeenTs)
  }, [driversById])

  const activeDriverCount = useMemo(() => {
    return driverRows.filter((driver) => clockTs - driver.lastSeenTs <= DRIVER_OFFLINE_MS)
      .length
  }, [driverRows, clockTs])

  const totalTripsToday = useMemo(() => {
    const today = new Date()
    return driverRows.reduce((total, driver) => {
      const pointsToday = driver.recentPoints.filter((point) => {
        const dt = new Date(point.ts)
        return (
          dt.getFullYear() === today.getFullYear() &&
          dt.getMonth() === today.getMonth() &&
          dt.getDate() === today.getDate()
        )
      }).length
      return total + pointsToday
    }, 0)
  }, [driverRows])

  const recentActivities = useMemo<ActivityItem[]>(() => {
    const driverActivities = driverRows.map((driver) => ({
      id: `driver-${driver.driverId}-${driver.lastSeenTs}`,
      title: driver.driverId,
      subtitle: driver.latestPoint.tripId ?? "Route update",
      ts: driver.lastSeenTs,
      variant: "ok" as const
    }))

    const alertActivities = alerts.map((alert) => ({
      id: `alert-${alert.driverId}-${alert.ts}`,
      title: `${alert.driverId} violation`,
      subtitle: alert.reason,
      ts: alert.ts,
      variant: "alert" as const
    }))

    return [...alertActivities, ...driverActivities]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 8)
  }, [alerts, driverRows])

  const pageLabel = NAV_ITEMS.find((item) => item.key === activePage)?.label ?? "Dashboard"

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
          {NAV_ITEMS.map((item) => (
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
            <div className="admin-topbar__crumb">DASHBOARD / BRGY 18-B</div>
            <div className="admin-topbar__sub">TODA : UMASA</div>
          </div>

          <div className="admin-topbar__controls">
            <input className="topbar-search" placeholder="Search unit ID..." />
            <div className="topbar-profile">
              <div className="profile-avatar">JV</div>
              <div>
                <div className="profile-name">J. VILLAVERDE</div>
                <div className="profile-meta">DRIVER - 12345</div>
              </div>
            </div>
          </div>
        </header>

        <main className="admin-content">
          {activePage === "home" && (
            <section className="page-stack">
              <div className="overview-grid">
                <article className="overview-card">
                  <div className="overview-card__label">Active Tricycles</div>
                  <div className="overview-card__value">
                    {activeDriverCount}
                    <span>/{REGISTERED_DRIVERS}</span>
                  </div>
                </article>

                <article className="overview-card">
                  <div className="overview-card__label">Active Alerts</div>
                  <div className="overview-card__value overview-card__value--danger">
                    {alerts.length.toString().padStart(2, "0")}
                  </div>
                </article>

                <article className="overview-card">
                  <div className="overview-card__label">Total Trips Today</div>
                  <div className="overview-card__value">{totalTripsToday.toLocaleString()}</div>
                </article>

                <article className="overview-card">
                  <div className="overview-card__label">Registered Drivers</div>
                  <div className="overview-card__value">{REGISTERED_DRIVERS}</div>
                </article>
              </div>

              <section className="page-panel">
                <div className="page-panel__header">
                  <h2>Recent Activities</h2>
                  <p>Real-time monitoring updates</p>
                </div>
                <div className="activity-list">
                  {recentActivities.length === 0 ? (
                    <div className="muted">No activities yet. Open Live Map to start tracking.</div>
                  ) : (
                    recentActivities.map((activity) => (
                      <div key={activity.id} className="activity-row">
                        <div className={`activity-icon activity-icon--${activity.variant}`} />
                        <div className="activity-text">
                          <div className="activity-title">{activity.title}</div>
                          <div className="activity-subtitle">{activity.subtitle}</div>
                        </div>
                        <div className="activity-time">{formatLastSeen(activity.ts, clockTs)}</div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </section>
          )}

          <section className={`live-map-grid ${activePage === "live-map" ? "" : "page-hidden"}`}>
              <section className="page-panel page-panel--map">
                <div className="page-panel__header">
                  <h2>Live Map</h2>
                  <p>Obrero to Agdao TODA Route</p>
                </div>
                <div className="admin-map" ref={mapEl} />
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
                    <div>Last WS update</div>
                    <div>{lastUpdateTs ? new Date(lastUpdateTs).toLocaleTimeString() : "-"}</div>
                  </div>
                </section>

                <section className="page-panel side-card">
                  <div className="admin-pane__title">Drivers</div>
                  <div className="drivers-list">
                    {driverRows.length === 0 ? (
                      <div className="muted">No active drivers yet.</div>
                    ) : (
                      driverRows.slice(0, 8).map((driver) => {
                        const isDriverOnline =
                          online && clockTs - driver.lastSeenTs <= DRIVER_OFFLINE_MS
                        return (
                          <div className="driver-row" key={driver.driverId}>
                            <div className="driver-row__top">
                              <strong>{driver.driverId}</strong>
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
                              Last seen {formatLastSeen(driver.lastSeenTs, clockTs)}
                            </div>
                            <div className="driver-row__meta">Point {formatPoint(driver.latestPoint)}</div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </section>

                <section className="page-panel side-card">
                  <div className="admin-pane__title">Alerts</div>
                  <div className="alerts-list">
                    {alerts.length === 0 ? (
                      <div className="muted">No route-corridor alerts yet.</div>
                    ) : (
                      alerts.slice(0, 8).map((alert) => (
                        <div key={`${alert.driverId}-${alert.ts}`} className="alert-row">
                          <div className="alert-row__top">
                            <strong>{alert.driverId}</strong>
                            <span>{new Date(alert.ts).toLocaleTimeString()}</span>
                          </div>
                          <div className="alert-row__meta">{alert.reason}</div>
                          <div className="alert-row__meta">
                            {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="page-panel side-card side-card--grow">
                  <div className="admin-pane__title">Trip Logs</div>
                  <div className="trip-logs-list">
                    {driverRows.length === 0 ? (
                      <div className="muted">Trip stream will appear once messages arrive.</div>
                    ) : (
                      driverRows.slice(0, 6).map((driver) => (
                        <div key={driver.driverId} className="trip-driver">
                          <div className="trip-driver__top">
                            <strong>{driver.driverId}</strong>
                            <span>{driver.recentPoints.length} recent points</span>
                          </div>
                          <div className="trip-driver__meta">
                            Last seen {formatLastSeen(driver.lastSeenTs, clockTs)} | Violations{" "}
                            {driver.violationCount} | Sync {syncStatus}
                          </div>
                          <div className="trip-points">
                            {driver.recentPoints.map((point) => (
                              <div className="trip-point" key={`${driver.driverId}-${point.ts}`}>
                                <span>{new Date(point.ts).toLocaleTimeString()}</span>
                                <span>
                                  {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </aside>
          </section>

          {activePage === "drivers" && (
            <section className="page-panel page-stack">
              <div className="page-panel__header">
                <h2>Drivers</h2>
                <p>{driverRows.length} tracked drivers</p>
              </div>
              <div className="drivers-list drivers-list--page">
                {driverRows.length === 0 ? (
                  <div className="muted">No active drivers yet.</div>
                ) : (
                  driverRows.map((driver) => {
                    const isDriverOnline =
                      online && clockTs - driver.lastSeenTs <= DRIVER_OFFLINE_MS
                    return (
                      <div className="driver-row" key={driver.driverId}>
                        <div className="driver-row__top">
                          <strong>{driver.driverId}</strong>
                          <span
                            className={
                              isDriverOnline ? "status-badge online" : "status-badge offline"
                            }
                          >
                            {isDriverOnline ? "Online" : "Offline"}
                          </span>
                        </div>
                        <div className="driver-row__meta">
                          Last seen {formatLastSeen(driver.lastSeenTs, clockTs)}
                        </div>
                        <div className="driver-row__meta">Point {formatPoint(driver.latestPoint)}</div>
                        <div className="driver-row__meta">Violations {driver.violationCount}</div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>
          )}

          {activePage === "alerts" && (
            <section className="page-panel page-stack">
              <div className="page-panel__header">
                <h2>Alerts</h2>
                <p>{alerts.length} total violations flagged</p>
              </div>
              <div className="alerts-list alerts-list--page">
                {alerts.length === 0 ? (
                  <div className="muted">No route-corridor alerts yet.</div>
                ) : (
                  alerts.map((alert) => (
                    <div key={`${alert.driverId}-${alert.ts}`} className="alert-row">
                      <div className="alert-row__top">
                        <strong>{alert.driverId}</strong>
                        <span>{new Date(alert.ts).toLocaleString()}</span>
                      </div>
                      <div className="alert-row__meta">{alert.reason}</div>
                      <div className="alert-row__meta">
                        {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {activePage === "trip-logs" && (
            <section className="page-panel page-stack">
              <div className="page-panel__header">
                <h2>Trip Logs</h2>
                <p>{pageLabel} monitoring stream</p>
              </div>
              <div className="trip-logs-list trip-logs-list--page">
                {driverRows.length === 0 ? (
                  <div className="muted">Trip stream will appear once messages arrive.</div>
                ) : (
                  driverRows.map((driver) => (
                    <div key={driver.driverId} className="trip-driver">
                      <div className="trip-driver__top">
                        <strong>{driver.driverId}</strong>
                        <span>{driver.recentPoints.length} recent points</span>
                      </div>
                      <div className="trip-driver__meta">
                        Last seen {formatLastSeen(driver.lastSeenTs, clockTs)} | Violations{" "}
                        {driver.violationCount} | Sync {syncStatus}
                      </div>
                      <div className="trip-points">
                        {driver.recentPoints.map((point) => (
                          <div className="trip-point" key={`${driver.driverId}-${point.ts}`}>
                            <span>{new Date(point.ts).toLocaleTimeString()}</span>
                            <span>
                              {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                            </span>
                          </div>
                        ))}
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
