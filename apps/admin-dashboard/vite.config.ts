import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import fs from "node:fs"
import path from "node:path"

const API_PROXY_TARGET = process.env.VITE_PROXY_TARGET || "http://127.0.0.1:4000"

const mockLocationsPlugin = (): Plugin => ({
  name: "mock-tricycle-locations",
  configureServer(server) {
    const mockPath = path.resolve(__dirname, "mock/locations.json")

    const readLocations = () => {
      try {
        const raw = fs.readFileSync(mockPath, "utf-8")
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
      } catch (error) {
        console.warn("Mock locations not available:", error)
        return []
      }
    }

    server.middlewares.use((req, res, next) => {
      if (!req.url) return next()
      if (!req.url.startsWith("/api/tricycles/locations")) return next()

      const points = readLocations()
      const step = Math.floor(Date.now() / 3000)
      const a = points.length ? points[step % points.length] : null
      const b = points.length ? points[(step + 3) % points.length] : null

      const items = []
      if (a) {
        items.push({
          id: "TRK-001",
          driverName: "Juan D.",
          ...a
        })
      }
      if (b) {
        items.push({
          id: "TRK-002",
          driverName: "Maria C.",
          ...b
        })
      }

      const body = JSON.stringify({ items })
      res.statusCode = 200
      res.setHeader("Content-Type", "application/json")
      res.setHeader("Cache-Control", "no-store")
      res.end(body)
    })
  }
})

export default defineConfig({
  server: {
    proxy: {
      "/api/auth": {
        target: API_PROXY_TARGET,
        changeOrigin: true
      },
      "/api/admin": {
        target: API_PROXY_TARGET,
        changeOrigin: true
      },
      "/api/violations": {
        target: API_PROXY_TARGET,
        changeOrigin: true
      },
      "/api/trip-points": {
        target: API_PROXY_TARGET,
        changeOrigin: true
      }
    }
  },
  plugins: [
    react(),
    mockLocationsPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "pwa-192.png", "pwa-512.png", "vite.svg"],
      manifest: {
        name: "TrikeTrack Admin",
        short_name: "TrikeTrack",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0b5cff",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
      }
    })
  ]
})
