# TrikeTrack Backend (Next.js)

This folder hosts the API backend for the barangay box.

## Why Next.js here
- Simple REST endpoints (route handlers) for admin + driver apps.
- TypeScript-first, easy to co-locate API handlers.

## Note on real-time
Next.js does not handle WebSockets well in serverless mode. For LAN live feed,
run a small WebSocket service alongside this API (we can add it under
`services/realtime` next).

## Dev
1. `npm install`
2. `npm run dev`
3. Health check: `GET /api/health` on port 4000
