import { requireAdminSession } from "../../../../../lib/admin-session"
import {
  getEmergencyAlertsChannelName,
  isEmergencyVisibleToAdmin,
  listEmergencyAlertsForAdmin
} from "../../../../../lib/emergency-alerts-db"
import { getPool } from "../../../../../lib/database"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const encoder = new TextEncoder()

const writeEvent = (event: string, data: unknown) =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

const writeComment = (value: string) => encoder.encode(`: ${value}\n\n`)

export async function GET(request: Request) {
  const session = await requireAdminSession(request)
  if (session.response) return session.response

  const pendingEmergencies = await listEmergencyAlertsForAdmin(session.profile, {
    onlyActive: true,
    limit: 10
  })

  const client = await getPool().connect()
  await client.query(`LISTEN ${getEmergencyAlertsChannelName()}`)

  let keepAliveTimer: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const cleanup = async () => {
        if (keepAliveTimer) {
          clearInterval(keepAliveTimer)
          keepAliveTimer = null
        }

        client.removeListener("notification", onNotification)
        request.signal.removeEventListener("abort", onAbort)
        await client.query(`UNLISTEN ${getEmergencyAlertsChannelName()}`).catch(() => null)
        client.release()
      }

      const onAbort = () => {
        void cleanup().finally(() => {
          controller.close()
        })
      }

      const onNotification = (message: { payload?: string }) => {
        if (!message.payload) return

        try {
          const parsed = JSON.parse(message.payload) as {
            type?: string
            alert?: {
              todaId?: number
              barangayId?: number
            }
          }

          if (parsed.type !== "upsert" || !parsed.alert) return
          if (!isEmergencyVisibleToAdmin(session.profile, parsed.alert)) return

          controller.enqueue(writeEvent("emergency", parsed))
        } catch {
          controller.enqueue(writeComment("invalid-payload"))
        }
      }

      request.signal.addEventListener("abort", onAbort)
      client.on("notification", onNotification)

      controller.enqueue(writeEvent("snapshot", { items: pendingEmergencies }))
      keepAliveTimer = setInterval(() => {
        controller.enqueue(writeComment("keepalive"))
      }, 25000)
    },
    cancel() {
      client.removeAllListeners("notification")
      client.query(`UNLISTEN ${getEmergencyAlertsChannelName()}`).catch(() => null)
      client.release()
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  })
}
