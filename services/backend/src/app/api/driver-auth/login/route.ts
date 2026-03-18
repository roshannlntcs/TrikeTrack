import { NextResponse } from "next/server"
import { loginDriver } from "../../../../lib/driver-auth-db"

const asDriverIdentifier = (value: unknown) =>
  typeof value === "string"
    ? value.trim() || null
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : null

const asValidPassword = (value: unknown) =>
  typeof value === "string" && value.trim().length >= 1 ? value : null

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: "Request body must be valid JSON." }, { status: 400 })
  }

  const raw = body as Record<string, unknown>
  const driverId = asDriverIdentifier(raw.driverId)
  const password = asValidPassword(raw.password)
  if (!driverId || !password) {
    return NextResponse.json(
      { ok: false, message: "Expected { driverId, password }." },
      { status: 400 }
    )
  }

  const result = await loginDriver(driverId, password)
  if (result.error === "DRIVER_NOT_FOUND") {
    return NextResponse.json({ ok: false, message: "Driver not found." }, { status: 404 })
  }
  if (result.error === "DRIVER_NOT_ACTIVE") {
    return NextResponse.json({ ok: false, message: "Driver is not active." }, { status: 403 })
  }
  if (result.error === "PASSWORD_NOT_SET") {
    return NextResponse.json(
      { ok: false, message: "Driver password is not set yet. Run first-time setup." },
      { status: 409 }
    )
  }
  if (result.error === "INVALID_CREDENTIALS") {
    return NextResponse.json(
      { ok: false, message: "Invalid driver ID/code or password." },
      { status: 401 }
    )
  }

  return NextResponse.json({ ok: true, profile: result.profile })
}
