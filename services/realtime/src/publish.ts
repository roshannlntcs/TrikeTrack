import WebSocket from "ws"
import type { DriverLocationEvent } from "../../../common/types"

const WS_URL = process.env.WS_URL ?? "ws://localhost:4001/ws"
const DRIVER_ID = process.env.DRIVER_ID ?? "D-001"
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? 1000)

// Approximate Obrero -> Agdao route points for local simulation
const route: Array<[number, number]> = [
  [125.6154, 7.08633],
  [125.6149, 7.0839],
  [125.6144, 7.0812],
  [125.61418, 7.0777],
  [125.6172, 7.0765],
  [125.6193, 7.0764],
  [125.6215, 7.0787],
  [125.62323, 7.08173],
  [125.6225, 7.0834],
  [125.6206, 7.0848],
  [125.6182, 7.0857],
  [125.6154, 7.08633]
]

const ws = new WebSocket(WS_URL)
let index = 0
let timer: NodeJS.Timeout | undefined

const sendNextPoint = () => {
  const [lng, lat] = route[index]
  const event: DriverLocationEvent = {
    type: "driver_location",
    driverId: DRIVER_ID,
    ts: Date.now(),
    lng,
    lat
  }
  ws.send(JSON.stringify(event))
  index = (index + 1) % route.length
}

ws.on("open", () => {
  console.log(`Connected to ${WS_URL} as ${DRIVER_ID}`)
  sendNextPoint()
  timer = setInterval(sendNextPoint, INTERVAL_MS)
})

ws.on("message", (data) => {
  const text = data.toString()
  if (text.includes("\"type\":\"error\"")) {
    console.error("Realtime rejected payload:", text)
  }
})

ws.on("close", () => {
  if (timer) clearInterval(timer)
  console.log("Publisher disconnected")
})

ws.on("error", (err) => {
  if (timer) clearInterval(timer)
  console.error("Publisher error:", err.message)
})

process.on("SIGINT", () => {
  if (timer) clearInterval(timer)
  ws.close()
  process.exit(0)
})
