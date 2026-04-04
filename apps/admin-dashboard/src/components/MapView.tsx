import { useEffect, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import * as turf from "@turf/turf"
import type { GeoJSON as MapGeoJSON } from "../types/geojson"
import type { DriverLocationEvent } from "../../../../common/types"
import geofenceRaw from "../data/geofence.geojson?raw"
import { enqueueViolation, getOutboxCount, savePoint } from "../lib/db"
import { syncOutbox } from "../lib/outbox"
import TripLogs from "./TripLogs"

const MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
const OBRERO_CENTER: [number, number] = [125.6128, 7.0848]
const DAVAO_CITY_BOUNDS: [[number, number], [number, number]] = [
  [125.48, 6.96],
  [125.71, 7.18]
]
const DEFAULT_CITY_ZOOM = 11
const DRIVER_OFFLINE_MS = 15000

export default function MapView() {
  const el = useRef<HTMLDivElement | null>(null)
  const [syncStatus, setSyncStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting")
  const [lastUpdateTs, setLastUpdateTs] = useState<number | null>(null)
  const [online, setOnline] = useState<boolean>(navigator.onLine)
  const [outboxCount, setOutboxCount] = useState<number>(0)
  const [outboxStatus, setOutboxStatus] = useState<
    "idle" | "syncing" | "error" | "offline"
  >("idle")

  useEffect(() => {
    if (!el.current) return

    const geofence = JSON.parse(geofenceRaw) as MapGeoJSON
    const OUTBOX_SYNC_MS = 5000
    const VIOLATION_SYNC_ENDPOINT =
      import.meta.env.VITE_VIOLATIONS_ENDPOINT || "/api/violations/batch"

    const map = new maplibregl.Map({
      container: el.current,
      style: MAP_STYLE_URL,
      center: OBRERO_CENTER,
      zoom: DEFAULT_CITY_ZOOM,
      minZoom: 10,
      maxZoom: 19
    })
    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        visualizePitch: false
      }),
      "top-right"
    )

    map.on("error", (e) => {
      console.error("MapLibre error:", (e as any)?.error || e)
    })

    let reconnectTimer: number | undefined
    let socket: WebSocket | null = null
    let active = true
    let onlineHandler: (() => void) | null = null
    let outboxTimer: number | undefined
    let outboxOnlineHandler: (() => void) | null = null
    let stalePresenceTimer: number | undefined
    const markers = new Map<string, maplibregl.Marker>()
    const lastSeenByDriver = new Map<string, number>()

    const refreshOutboxCount = async () => {
      try {
        const count = await getOutboxCount()
        if (active) setOutboxCount(count)
      } catch (err) {
        console.warn("Outbox count failed:", err)
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

    const pruneStaleMarkers = () => {
      const now = Date.now()
      for (const [driverId, lastSeenTs] of lastSeenByDriver.entries()) {
        if (now - lastSeenTs <= DRIVER_OFFLINE_MS) continue
        const marker = markers.get(driverId)
        if (marker) {
          marker.remove()
          markers.delete(driverId)
        }
        lastSeenByDriver.delete(driverId)
      }
    }

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

    map.on("load", () => {
      console.log("MAP LOADED")

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

      map.setMaxBounds(DAVAO_CITY_BOUNDS)
      map.easeTo({
        center: OBRERO_CENTER,
        zoom: DEFAULT_CITY_ZOOM,
        duration: 0
      })

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
      }

      const updateMarker = async (event: DriverLocationEvent) => {
        lastSeenByDriver.set(event.driverId, event.ts)
        const inside = turf.booleanPointInPolygon(
          turf.point([event.lng, event.lat]),
          geofencePolygon as any
        )
        const color = inside ? "#2563eb" : "#ef4444"

        const existing = markers.get(event.driverId)
        if (existing) {
          existing.setLngLat([event.lng, event.lat])
          const el = existing.getElement()
          el.style.background = color
        } else {
          const markerEl = createMarkerElement(color)
          const marker = new maplibregl.Marker({ element: markerEl })
            .setLngLat([event.lng, event.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 12 }).setText(event.driverId)
            )
            .addTo(map)
          markers.set(event.driverId, marker)
        }

        if (!inside) {
          console.warn("VIOLATION: outside geofence boundary", {
            id: event.driverId,
            lng: event.lng,
            lat: event.lat
          })
          await enqueueViolation({
            driverId: event.driverId,
            ts: event.ts,
            lng: event.lng,
            lat: event.lat,
            routeId: "umasa-brgy-18b-geofence",
            reason: "OUTSIDE_ROUTE_CORRIDOR",
            speed: event.speed,
            heading: event.heading,
            accuracy: event.accuracy
          })
          await refreshOutboxCount()
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
          violation: !inside
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

        socket.onclose = () => {
          console.log("ADMIN WS closed")
          setSyncStatus("disconnected")
          if (reconnectTimer) window.clearTimeout(reconnectTimer)
          if (navigator.onLine) {
            reconnectTimer = window.setTimeout(connectSocket, 3000)
          }
        }

        socket.onerror = (event) => {
          console.log("ADMIN WS error", event)
          setSyncStatus("disconnected")
        }

        socket.onmessage = (event) => {
          console.log("ADMIN WS message", event.data)
          if (!active) return
          try {
            const payload = JSON.parse(event.data) as unknown
            const locationEvent = toDriverLocationEvent(payload)
            if (!locationEvent) {
              console.warn("Rejected WS payload: invalid DriverLocationEvent")
              return
            }
            void updateMarker(locationEvent).then(() => {
              if (active) setLastUpdateTs(Date.now())
            })
          } catch (err) {
            console.warn("WS payload error:", err)
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
        }
      }

      onlineHandler = handleOnlineState
      window.addEventListener("online", handleOnlineState)
      window.addEventListener("offline", handleOnlineState)

      connectSocket()
    })

    refreshOutboxCount()
    runOutboxSync()
    outboxTimer = window.setInterval(runOutboxSync, OUTBOX_SYNC_MS)
    outboxOnlineHandler = () => {
      if (!navigator.onLine) {
        setOutboxStatus("offline")
      }
      void runOutboxSync()
    }
    window.addEventListener("online", outboxOnlineHandler)
    window.addEventListener("offline", outboxOnlineHandler)
    stalePresenceTimer = window.setInterval(pruneStaleMarkers, 3000)

    return () => {
      active = false
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      if (socket) socket.close()
      for (const marker of markers.values()) {
        marker.remove()
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
      map.remove()
    }
  }, [])

  return (
    <div style={{ padding: "16px", display: "grid", gap: "12px" }}>
      <div style={{ fontSize: "18px", fontWeight: 600 }}>
        UMASA TODA Geofence Boundary
      </div>
      <div
        ref={el}
        style={{
          width: "100%",
          height: "70vh",
          minHeight: "360px",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid #e0e0e0"
        }}
      />
      <TripLogs
        limit={30}
        online={online}
        status={syncStatus}
        lastUpdateTs={lastUpdateTs}
        outboxCount={outboxCount}
        outboxStatus={outboxStatus}
      />
    </div>
  )
}
