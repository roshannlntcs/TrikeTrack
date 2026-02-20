import { NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "triketrack-backend",
    time: new Date().toISOString()
  })
}
