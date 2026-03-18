# TrikeTrack Backend (Next.js)

This folder hosts the API backend for the barangay box.

## Storage

The backend now uses PostgreSQL instead of local JSON files or in-memory stores.
This is compatible with a self-hosted Supabase deployment later because Supabase
also uses PostgreSQL underneath.

Tables are bootstrapped automatically on first request, and the same SQL is also
checked in at `db/schema.sql`.

## Environment

Copy `.env.example` to `.env.local` and set:

- `DATABASE_URL`
- `DATABASE_SSL`

Example:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/triketrack
DATABASE_SSL=false
```

## Dev

1. Start a PostgreSQL database.
2. `npm install`
3. `npm run dev`
4. Health check: `GET /api/health` on port `4000`

## Current endpoints

- `POST /api/auth/login`
- `POST /api/trip-points/batch`
- `GET /api/trip-points/recent`
- `POST /api/violations/batch`
- `GET /api/health`

## Sync flow

The intended shared-data flow with your Expo driver app is now:

- Driver app stores trip points locally while offline.
- When a connection returns, it sends cached `trip_point` events to
  `POST /api/trip-points/batch`.
- The backend stores them in PostgreSQL tables compatible with a Supabase-backed
  deployment: `drivers`, `trips`, and `trip_points`.
- The admin side can retrieve recent synchronized points from
  `GET /api/trip-points/recent`.
