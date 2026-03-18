import { NextResponse } from "next/server"

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

export async function POST() {
  return withCors(
    NextResponse.json(
      {
        ok: false,
        message: "Deprecated. Use Supabase Auth from the client and /api/auth/me for profile lookup."
      },
      { status: 410 }
    )
  )
}
