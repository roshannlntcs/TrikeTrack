type ExpoPushPayload = {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: "default" | null
  channelId?: string
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

export const isExpoPushToken = (token: string | null | undefined) =>
  typeof token === "string" &&
  /^(ExpoPushToken|ExponentPushToken)\[[^\]]+\]$/.test(token.trim())

export const sendExpoPushNotification = async (payload: ExpoPushPayload) => {
  const token = payload.to.trim()
  if (!isExpoPushToken(token)) {
    throw new Error("The reset request does not have a valid Expo push token.")
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...payload,
      to: token,
      sound: payload.sound ?? "default"
    })
  })

  const body = (await response.json().catch(() => null)) as
    | { data?: { status?: string; message?: string; details?: unknown } }
    | null

  if (!response.ok) {
    throw new Error(`Expo push request failed with HTTP ${response.status}.`)
  }

  if (body?.data?.status === "error") {
    throw new Error(body.data.message ?? "Expo push notification was rejected.")
  }

  return body
}
