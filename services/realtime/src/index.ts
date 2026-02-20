import http from "node:http"
import { WebSocket, WebSocketServer } from "ws"
import type { DriverLocationEvent } from "../../../common/types"

const PORT = Number(process.env.PORT ?? 4001)
const WS_PATH = process.env.WS_PATH ?? "/ws"

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true, service: "triketrack-realtime" }))
    return
  }

  res.writeHead(404, { "Content-Type": "text/plain" })
  res.end("Not found")
})

const wss = new WebSocketServer({ server, path: WS_PATH })
const clients = new Set<WebSocket>()

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const isString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

const toDriverLocationEvent = (payload: unknown): DriverLocationEvent | null => {
  if (!payload || typeof payload !== "object") return null
  const raw = payload as Record<string, unknown>
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

const broadcast = (data: string | Buffer) => {
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(data)
    }
  }
}

wss.on("connection", (socket) => {
  clients.add(socket)

  socket.on("message", (data) => {
    try {
      const payload = JSON.parse(data.toString()) as unknown
      const event = toDriverLocationEvent(payload)
      if (!event) {
        socket.send(
          JSON.stringify({
            type: "error",
            code: "INVALID_EVENT",
            message: "Expected DriverLocationEvent"
          })
        )
        return
      }

      broadcast(JSON.stringify(event))
    } catch {
      socket.send(
        JSON.stringify({
          type: "error",
          code: "INVALID_JSON",
          message: "Message must be valid JSON"
        })
      )
    }
  })

  socket.on("close", () => {
    clients.delete(socket)
  })

  socket.on("error", () => {
    clients.delete(socket)
  })
})

server.listen(PORT, () => {
  console.log(`Realtime WS server on ws://localhost:${PORT}${WS_PATH}`)
})
