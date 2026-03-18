import { NextResponse } from "next/server"
import { setupDriverPassword } from "../../../../lib/driver-auth-db"

const asDriverIdentifier = (value: unknown) =>
  typeof value === "string"
    ? value.trim() || null
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : null

const asValidPassword = (value: unknown) =>
  typeof value === "string" && value.trim().length >= 6 ? value : null

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
      {
        ok: false,
        message: "Expected { driverId, password } with a password of at least 6 characters."
      },
      { status: 400 }
    )
  }

  const result = await setupDriverPassword(driverId, password)
  if (result.error === "DRIVER_NOT_FOUND") {
    return NextResponse.json({ ok: false, message: "Driver not found." }, { status: 404 })
  }
  if (result.error === "DRIVER_NOT_ACTIVE") {
    return NextResponse.json({ ok: false, message: "Driver is not active." }, { status: 403 })
  }
  if (result.error === "PASSWORD_ALREADY_SET") {
    return NextResponse.json(
      { ok: false, message: "Password is already set for this driver." },
      { status: 409 }
    )
  }

  return NextResponse.json({ ok: true, profile: result.profile })
}
