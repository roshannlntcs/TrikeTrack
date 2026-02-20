import WebSocket from "ws"
import type { DriverLocationEvent } from "../../../common/types"

const WS_URL = process.env.WS_URL ?? "ws://localhost:4001/ws"
const DRIVER_ID = process.env.DRIVER_ID ?? "DRIVER-001"

const track: Array<[number, number]> = [
  [125.6154, 7.08633],
  [125.61418, 7.0777],
  [125.62323, 7.08173],
  [125.6154, 7.08633]
]

const ws = new WebSocket(WS_URL)

let i = 0
let timer: NodeJS.Timeout | undefined

ws.on("open", () => {
  console.log("[PUBLISHER] connected:", WS_URL)

  timer = setInterval(() => {
    i = (i + 1) % track.length
    const [lng, lat] = track[i]

    const event: DriverLocationEvent = {
      type: "driver_location",
      driverId: DRIVER_ID,
      ts: Date.now(),
      lng,
      lat
    }

    const payload = JSON.stringify(event)
    ws.send(payload)
    console.log("[PUBLISHER] sent:", payload)
  }, 1000)
})

ws.on("message", (data) => {
  console.log("[PUBLISHER] received:", data.toString())
})

ws.on("close", (code, reason) => {
  console.log("[PUBLISHER] closed:", code, reason.toString())
  if (timer) clearInterval(timer)
})

ws.on("error", (err) => {
  console.error("[PUBLISHER] error:", err)
  if (timer) clearInterval(timer)
})
