import { redirect } from "next/navigation"

type ReportPageProps = {
  params: {
    qrToken: string
  }
}

const firstConfiguredUrl = (...values: Array<string | undefined>) =>
  values.map((value) => value?.trim()).find((value) => Boolean(value)) ?? ""

const PASSENGER_APP_BASE_URL = firstConfiguredUrl(
  process.env.PUBLIC_PASSENGER_REPORT_BASE_URL,
  process.env.PASSENGER_APP_BASE_URL,
  process.env.PUBLIC_PASSENGER_REPORT_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.URL,
  process.env.DEPLOY_PRIME_URL
)

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])

const isPrivateIpv4Hostname = (hostname: string) => {
  const match = hostname.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!match) return false

  const octets = match.slice(1).map((part) => Number(part))
  if (octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false
  }

  const [a, b] = octets
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

const resolvePassengerAppBaseUrl = () => {
  if (!PASSENGER_APP_BASE_URL) {
    return {
      url: null,
      error:
        "Passenger reporting URL is not configured. Set PUBLIC_PASSENGER_REPORT_BASE_URL to a public passenger reporting deployment URL."
    }
  }

  try {
    const parsed = new URL(PASSENGER_APP_BASE_URL)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        url: null,
        error: "Passenger reporting URL must use http:// or https://."
      }
    }

    if (LOOPBACK_HOSTS.has(parsed.hostname.trim().toLowerCase())) {
      return {
        url: null,
        error:
          "Passenger reporting URL cannot use localhost or 127.0.0.1. Use a public deployment URL that any phone can reach."
      }
    }

    if (isPrivateIpv4Hostname(parsed.hostname)) {
      return {
        url: null,
        error:
          "Passenger reporting URL cannot use a private LAN IP. Use a public deployment URL that any phone can reach over the internet."
      }
    }

    return {
      url: parsed.toString().replace(/\/+$/, ""),
      error: null
    }
  } catch {
    return {
      url: null,
      error:
        "Passenger reporting URL is invalid. Set PUBLIC_PASSENGER_REPORT_BASE_URL to a full public URL like https://your-app.vercel.app."
    }
  }
}

export default function ReportPage({ params }: ReportPageProps) {
  const passengerAppBase = resolvePassengerAppBaseUrl()

  if (!passengerAppBase.url) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f5f7f9"
        }}
      >
        <section
          style={{
            width: "min(720px, 100%)",
            border: "1px solid #d9e1e7",
            borderRadius: "24px",
            background: "#ffffff",
            padding: "28px",
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)"
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#3f647f"
            }}
          >
            Passenger Reporting
          </p>
          <h1 style={{ margin: "14px 0 10px", fontSize: "2rem", color: "#17212b" }}>
            Reporting link unavailable
          </h1>
          <p style={{ margin: 0, lineHeight: 1.6, color: "#425466" }}>
            {passengerAppBase.error}
          </p>
        </section>
      </main>
    )
  }

  const nextUrl = new URL(
    `${passengerAppBase.url}/report/${encodeURIComponent(params.qrToken)}`
  )
  nextUrl.searchParams.set("apiBase", "")

  const forwardedHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.URL?.trim()

  if (forwardedHost) {
    try {
      const parsed = new URL(forwardedHost)
      nextUrl.searchParams.set("apiBase", parsed.toString().replace(/\/+$/, ""))
    } catch {
      nextUrl.searchParams.delete("apiBase")
    }
  } else {
    nextUrl.searchParams.delete("apiBase")
  }

  redirect(nextUrl.toString())
}
