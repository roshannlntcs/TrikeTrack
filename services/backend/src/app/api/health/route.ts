import { NextResponse } from "next/server"
import { checkDatabaseHealth } from "../../../lib/database"

export async function GET() {
  try {
    const databaseOk = await checkDatabaseHealth()

    return NextResponse.json({
      ok: databaseOk,
      service: "triketrack-backend",
      database: databaseOk ? "ok" : "error",
      time: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: "triketrack-backend",
        database: "error",
        error: String(error),
        time: new Date().toISOString()
      },
      { status: 503 }
    )
  }
}
