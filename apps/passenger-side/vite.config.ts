import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"

const API_PROXY_TARGET = process.env.VITE_PROXY_TARGET || "http://127.0.0.1:4000"
const VERCEL_URL = process.env.VITE_VERCEL_URL ?? process.env.VERCEL_URL
const VERCEL_PROJECT_PRODUCTION_URL =
  process.env.VITE_VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL

export default defineConfig({
  define: {
    "import.meta.env.VITE_VERCEL_URL": JSON.stringify(VERCEL_URL),
    "import.meta.env.VITE_VERCEL_PROJECT_PRODUCTION_URL": JSON.stringify(
      VERCEL_PROJECT_PRODUCTION_URL
    )
  },
  resolve: {
    alias: [
      {
        find: /^maplibre-gl$/,
        replacement: path.resolve(__dirname, "node_modules/maplibre-gl/dist/maplibre-gl.js")
      }
    ]
  },
  server: {
    proxy: {
      "/api": {
        target: API_PROXY_TARGET,
        changeOrigin: true
      }
    }
  },
  plugins: [react()]
})
