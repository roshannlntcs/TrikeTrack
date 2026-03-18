import { useEffect, useState } from "react"
import { getRecentPoints, type LocationPoint } from "../lib/db"

type TripLogsProps = {
  limit?: number
  refreshMs?: number
  status?: "connecting" | "connected" | "disconnected"
  lastUpdateTs?: number | null
  online?: boolean
  outboxCount?: number
  outboxStatus?: "idle" | "syncing" | "error" | "offline"
}

export default function TripLogs({
  limit = 20,
  refreshMs = 3000,
  status,
  lastUpdateTs,
  online,
  outboxCount = 0,
  outboxStatus = "idle"
}: TripLogsProps) {
  const [points, setPoints] = useState<LocationPoint[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let timer: number | undefined

    const load = async () => {
      try {
        const data = await getRecentPoints(limit)
        setPoints(data)
        setError(null)
      } catch (err) {
        setError(String(err))
      }
    }

    void load()
    timer = window.setInterval(load, refreshMs)

    return () => {
      if (timer) window.clearInterval(timer)
    }
  }, [limit, refreshMs])

  const statusLabel = (() => {
    if (online === false) return "Offline (cached)"
    if (status === "connected") return "Live"
    if (status === "connecting") return "Connecting"
    if (status === "disconnected") return "Disconnected"
    return "Unknown"
  })()

  const lastUpdateLabel = lastUpdateTs
    ? new Date(lastUpdateTs).toLocaleTimeString()
    : "-"

  const outboxStatusLabel = (() => {
    if (outboxStatus === "syncing") return "Syncing"
    if (outboxStatus === "error") return "Error"
    if (outboxStatus === "offline") return "Offline"
    return "Idle"
  })()

  return (
    <div
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: "12px",
        padding: "12px"
      }}
    >
      <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
        Trip Logs (Last {limit})
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "160px 1fr",
          gap: "8px",
          fontSize: "12px",
          color: "#4b5563",
          marginBottom: "10px"
        }}
      >
        <div>Status: {statusLabel}</div>
        <div>Last Update: {lastUpdateLabel}</div>
        <div>Outbox: {outboxCount} pending</div>
        <div>Sync: {outboxStatusLabel}</div>
      </div>
      {error ? (
        <div style={{ color: "#b91c1c" }}>Failed to load: {error}</div>
      ) : points.length === 0 ? (
        <div style={{ color: "#6b7280" }}>No points saved yet.</div>
      ) : (
        <div style={{ display: "grid", gap: "6px" }}>
          {points.map((point) => (
            <div
              key={point.id ?? `${point.driverId}-${point.ts}`}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr 1fr 1fr",
                gap: "8px",
                fontSize: "13px"
              }}
            >
              <div>{new Date(point.ts).toLocaleTimeString()}</div>
              <div>{point.driverId}</div>
              <div>
                {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
              </div>
              <div style={{ color: point.violation ? "#b91c1c" : "#15803d" }}>
                {point.violation ? "VIOLATION" : "OK"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
