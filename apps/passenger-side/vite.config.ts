import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const API_PROXY_TARGET = process.env.VITE_PROXY_TARGET || "http://127.0.0.1:4000"

export default defineConfig({
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
