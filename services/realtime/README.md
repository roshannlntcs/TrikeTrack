# TrikeTrack Realtime

Simple WebSocket broadcast service for LAN live tracking.

## Dev
1. `npm install`
2. `npm run dev`
3. Health check: `GET /health` on port 4001
4. Optional publisher: `npm run publish:mock-driver`

## Usage
- WebSocket path: `/ws`
- Server accepts only `DriverLocationEvent` JSON and rejects invalid payloads.
- Valid events are broadcast to all subscribers.

Example payload:
```json
{
  "type": "driver_location",
  "driverId": "D-001",
  "ts": 1739952000000,
  "lng": 125.6154,
  "lat": 7.08633
}
```
