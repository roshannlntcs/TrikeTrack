import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import fs from "node:fs"
import path from "node:path"

const API_PROXY_TARGET = process.env.VITE_PROXY_TARGET || "http://127.0.0.1:4000"
const VERCEL_URL = process.env.VITE_VERCEL_URL ?? process.env.VERCEL_URL
const VERCEL_PROJECT_PRODUCTION_URL =
  process.env.VITE_VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL

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
  define: {
    "import.meta.env.VITE_VERCEL_URL": JSON.stringify(VERCEL_URL),
    "import.meta.env.VITE_VERCEL_PROJECT_PRODUCTION_URL": JSON.stringify(
      VERCEL_PROJECT_PRODUCTION_URL
    )
  },
  resolve: {
    extensions: [".mjs", ".mts", ".ts", ".tsx", ".js", ".jsx", ".json"],
    alias: [
      {
        find: /^maplibre-gl$/,
        replacement: path.resolve(__dirname, "node_modules/maplibre-gl/dist/maplibre-gl.js")
      }
    ]
  },
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
      includeAssets: ["pwa-192.png", "pwa-512.png", "triketrack_logo.png"],
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
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
            options: {
              cacheName: "triketrack-admin-api"
            }
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "triketrack-admin-images",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ]
})
