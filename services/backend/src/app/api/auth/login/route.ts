import { NextResponse } from "next/server"
import { findAdminByEmail } from "../../../../lib/admin-auth-db"
import { verifyPassword } from "../../../../lib/password"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
}

const withCors = (response: NextResponse) => {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }))
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return withCors(
      NextResponse.json(
        {
          ok: false,
          message: "Invalid JSON payload."
        },
        { status: 400 }
      )
    )
  }

  const payload = body as Record<string, unknown>
  const email = typeof payload.email === "string" ? payload.email.trim() : ""
  const password =
    typeof payload.password === "string" ? payload.password : ""

  if (!email || !password) {
    return withCors(
      NextResponse.json(
        {
          ok: false,
          message: "Email and password are required."
        },
        { status: 400 }
      )
    )
  }

  const user = findAdminByEmail(email)
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return withCors(
      NextResponse.json(
        {
          ok: false,
          message: "incorrect email or password, please try again"
        },
        { status: 401 }
      )
    )
  }

  return withCors(
    NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email
      }
    })
  )
}
