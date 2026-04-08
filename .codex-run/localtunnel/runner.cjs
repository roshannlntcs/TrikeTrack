const fs = require("fs")
const path = require("path")
const localtunnel = require("localtunnel")

const port = Number(process.env.PORT || "5174")
const statePath = path.join(__dirname, "state.json")

const writeState = (payload) => {
  fs.writeFileSync(statePath, JSON.stringify(payload, null, 2))
}

const main = async () => {
  writeState({ status: "starting", port, startedAt: new Date().toISOString() })

  const tunnel = await localtunnel({ port })
  writeState({
    status: "ready",
    port,
    url: tunnel.url,
    startedAt: new Date().toISOString()
  })

  tunnel.on("close", () => {
    writeState({
      status: "closed",
      port,
      closedAt: new Date().toISOString()
    })
    process.exit(0)
  })
}

main().catch((error) => {
  writeState({
    status: "error",
    port,
    error: error instanceof Error ? error.message : String(error),
    failedAt: new Date().toISOString()
  })
  throw error
})
