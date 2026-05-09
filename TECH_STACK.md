# TrikeTrack System - Tech Stack Analysis

## System Overview
TrikeTrack is a comprehensive tricycle fleet management system with three main client applications (Admin Dashboard, Passenger App, and Driver App) and backend services. The system manages routing, real-time location tracking, trip management, violations, and reporting.

---

## 1. FRONTEND APPLICATIONS

### 1.1 Admin Dashboard (`apps/admin-dashboard/`)
**Purpose:** Manage fleet operations, track drivers, handle violations, manage admins, and generate reports

**Tech Stack:**
- **Framework:** React 19.2.0 with React DOM 19.2.0
- **Language:** TypeScript 5.9.3
- **Build Tool:** Vite 7.3.1
- **Module System:** ESNext with bundler resolution
- **Package Format:** ES Modules

**Key Dependencies:**
- **UI/UX Features:**
  - MapLibre GL 5.24.0 - Interactive maps & geofencing
  - QRCode 1.5.4 - QR code generation
  - Turf.js 7.3.4 - Geospatial analysis

- **Backend Integration:**
  - Supabase JS SDK 2.99.1 - Authentication & real-time database
  - IDB 8.0.3 - IndexedDB wrapper for offline storage

- **PWA Features:** Vite PWA Plugin 1.2.0 - Progressive Web App support

**Code Structure:**
- Authentication module (AdminLogin)
- Components: MapView, ReportsPage, TripLogs, DeleteConfirmDialog
- Layout: AdminShell (main container)
- Superadmin & TODA management pages
- Live map with geofence visualization
- Report generation & analytics

**Build Scripts:**
```
dev: vite                                    # Development server
build: tsc -b && vite build                  # TypeScript compilation + bundling
lint: eslint .                               # Code linting
preview: vite preview                        # Production preview
```

**Configuration:**
- TypeScript strict mode enabled
- ESLint with React hooks & refresh plugins
- Source map generation
- Path aliases for maplibre-gl imports

---

### 1.2 Passenger Side App (`apps/passenger-side/`)
**Purpose:** Passenger booking, trip tracking, and real-time driver location

**Tech Stack:**
- **Framework:** React 19.2.0 with React DOM 19.2.0
- **Language:** TypeScript 5.9.3
- **Build Tool:** Vite 7.3.1
- **Server Configuration:** Host 0.0.0.0, Port 5174 (dev), 4174 (preview)

**Key Dependencies:**
- **Maps:** MapLibre GL 5.18.0 - Real-time driver location display
- **Minimal Styling:** No UI framework (vanilla CSS)

**Code Structure:**
- ActiveTrip API integration (`active-trip-api.ts`)
- Emergency API integration (`emergency-api.ts`)
- Maps module with basemap configuration
- Clean, minimal architecture

**Build Scripts:**
```
dev: vite --host 0.0.0.0 --port 5174
build: tsc -b && vite build
preview: vite preview --host 0.0.0.0 --port 4174
```

---

### 1.3 Shared Components (`common/`)
**Purpose:** Shared types, utilities, and components across all frontends

**Contents:**
- **Shared Types** (`types.ts`) - Common event types (DriverLocationEvent, ViolationEvent, TripPointEvent, etc.)
- **Maps Module** - BasemapConfiguration, TriketrackMap component, markers, live location utilities
- **Styling** - Shared CSS for TriketrackMap component

---

## 2. BACKEND SERVICES

### 2.1 Main Backend (`services/backend/`)
**Purpose:** API server for admin operations, authentication, data persistence, and business logic

**Tech Stack:**
- **Framework:** Next.js 14.2.5 (full-stack React framework with API routes)
- **Language:** TypeScript 5.4.5
- **Database:** PostgreSQL 
- **Database Client:** Node PostgreSQL (pg 8.20.0)
- **Runtime:** Node.js

**Database Schema (`db/`):**
- PostgreSQL with custom types and enums
- **Key Tables:**
  - Admin roles (superadmin, barangay_admin, toda_admin)
  - Entity status (active, inactive, suspended)
  - QR status management
  - Trip management (scheduled, ongoing, completed, cancelled)
  - Report tracking
  - Violation tracking with appeals
  - Location history
  - Emergency alerts

**Migration Files:**
- `schema.sql` - Core database schema
- `add_admin_notification_reads.sql`
- `add_driver_avatar_url.sql`
- `add_driver_code.sql`
- `add_driver_locations_and_trip_paths.sql`
- `add_emergency_alerts.sql`
- `add_mobile_shared_tables.sql`
- `add_route_default_fares.sql`
- `add_violation_appeal_view_state.sql`
- `add_violation_location_fields.sql`
- `passenger_report_storage.sql`

**API Routes Structure:**
- `/api/admin/` - Admin operations
- `/api/auth/` - Admin authentication
- `/api/driver-auth/` - Driver authentication
- `/api/driver-locations/` - Driver location tracking
- `/api/trips/` - Trip management
- `/api/trip-points/` - Trip waypoint tracking
- `/api/violations/` - Violation tracking & appeals
- `/api/public/` - Public endpoints
- `/api/health/` - Health checks

**Server Configuration:**
```
dev: next dev -H 0.0.0.0 -p 4000           # Dev server
build: next build                           # Production build
start: next start -H 0.0.0.0 -p 4000       # Production start
```

**Database Libraries (`src/lib/`):**
- `admin-auth-db.ts` - Admin authentication system
- `driver-auth-db.ts` - Driver authentication system
- `driver-locations-db.ts` - GPS tracking persistence
- `trips-db.ts` - Trip lifecycle management
- `violations-db.ts` - Violation recording & tracking
- `emergency-alerts-db.ts` - Emergency event handling
- `reports-db.ts` - Report generation data layer
- `appeals-db.ts` - Violation appeal system
- `password-hash.ts` - Secure password handling
- `supabase-auth.ts` - Supabase integration
- `supabase-storage.ts` - File storage via Supabase

**Report System:**
- `/src/app/report/` - Report generation logic

---

### 2.2 Real-time Service (`services/realtime/`)
**Purpose:** WebSocket server for real-time driver location updates to clients

**Tech Stack:**
- **Framework:** Node.js with WebSocket (ws 8.17.0)
- **Language:** TypeScript 5.4.5
- **Development:** tsx 4.15.7 (TypeScript executor)

**Architecture:**
- HTTP server on Port 4001 (configurable via PORT env var)
- WebSocket server at `/ws` path (configurable via WS_PATH env var)
- Health check endpoint at `/health`

**Key Features:**
- Bi-directional WebSocket communication
- Event validation and type checking
- Driver location event streaming
- Client set management for broadcast capabilities
- Mock driver location publishing (`driver-publisher.ts`)

**Event Types Handled:**
- `driver_location` - Real-time GPS coordinates with optional speed, heading, accuracy
- Validation of finite numbers and string formats
- Trip ID and accuracy tracking

**Build Scripts:**
```
dev: tsx watch src/index.ts                 # Dev with hot reload
publish:mock-driver: tsx src/driver-publisher.ts  # Mock data generation
build: tsc -p tsconfig.json                 # Type checking & compilation
start: node dist/index.js                   # Production run
```

---

## 3. INFRASTRUCTURE & DEPLOYMENT

### Cloud Services
- **Supabase** - Authentication, real-time database, storage
  - Admin Dashboard connects to Supabase for auth & data sync
  - File storage for documents/reports
  - Real-time listeners for trip updates

### Hosting Platforms
- **Vercel** - Deployment targets configured
  - Admin Dashboard: `vercel.json` configured
  - Passenger App: `vercel.json` configured
  - Backend: Potentially Vercel or alternative

### Environment Configuration
- **Environment Variables:**
  - `VITE_SUPABASE_URL` - Supabase endpoint
  - `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_ANON_KEY` - Authentication
  - `VITE_PROXY_TARGET` - Backend API target (default: http://127.0.0.1:4000)
  - `PORT` - WebSocket server port (default: 4001)
  - `WS_PATH` - WebSocket path (default: /ws)

---

## 4. DEVELOPMENT TOOLING

### Code Quality
- **TypeScript** - Version 5.4-5.9 with strict mode
  - All sub-projects use strict type checking
  - `noUnusedLocals` and `noUnusedParameters` enforced

- **ESLint** - Linting and code standards
  - Plugins: React hooks, React refresh
  - Configuration: `eslint.config.js` in admin-dashboard

### Build & Bundling
- **Vite** - Frontend bundling (7.3.1)
  - Instant HMR (Hot Module Replacement)
  - Optimized production builds
  - Plugin system for custom middleware

- **Next.js** - Backend framework with built-in optimization

### Development Environment
- **Node.js** runtime
- **tsx** - TypeScript execution without compilation step
- **ts-node compatible** environment

---

## 5. SECURITY & AUTHENTICATION

### Authentication Methods
1. **Admin Authentication** - Supabase Auth + DB-backed admin sessions
2. **Driver Authentication** - Custom JWT/session system
3. **Passenger Authentication** - Trip-based access (implied from API structure)

### Password Security
- `password-hash.ts` - Bcrypt or similar hashing
- `password.ts` - Password validation utilities

### Data Protection
- PostgreSQL with pgcrypto extension
- Supabase Auth integration
- IDB for client-side encryption of offline data

---

## 6. DATA FLOW & INTEGRATIONS

### Real-time Data Pipeline
1. **Driver** → Publishes location via WebSocket to realtime service
2. **Realtime Service** → Broadcasts to connected clients (admins & passengers)
3. **Admin/Passenger** → Displays on MapLibre maps
4. **Backend** → Persists to PostgreSQL for historical tracking

### Violations & Alerts
1. Driver location checked against geofences (Turf.js)
2. Violations recorded in database
3. Violation appeals system with state tracking
4. Admin notifications stored in database

### Trip Management
- Trip creation, ongoing status, completion
- Waypoint tracking (trip-points)
- Route corridor violation detection
- Fare calculation with route defaults

### Reporting
- Report generation from aggregated data
- Passenger incident reports
- Driver performance analytics
- Violation trends & appeals status

---

## 7. KEY TECHNOLOGIES SUMMARY TABLE

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Frontend Framework** | React | 19.2.0 | UI rendering |
| **Language** | TypeScript | 5.4-5.9 | Type safety |
| **Build Tool** | Vite | 7.3.1 | Bundling & dev server |
| **Backend** | Next.js | 14.2.5 | API & server |
| **Database** | PostgreSQL | (latest) | Data persistence |
| **Real-time** | WebSocket (ws) | 8.17.0 | Live location streaming |
| **Maps** | MapLibre GL | 5.18-5.24 | Geospatial visualization |
| **Auth** | Supabase Auth | 2.99.1 | Authentication & DB |
| **Local Storage** | IndexedDB (idb) | 8.0.3 | Offline support |
| **Geospatial** | Turf.js | 7.3.4 | Route/geofence analysis |
| **QR Codes** | qrcode | 1.5.4 | Permit generation |
| **PWA** | Vite PWA | 1.2.0 | Offline capability |
| **Deployment** | Vercel | - | Cloud hosting |
| **Code Quality** | ESLint | 9.39.1 | Linting |

---

## 8. ARCHITECTURE PATTERNS

### Monorepo Structure
- Shared configuration at root
- Applications isolated in `apps/`
- Services isolated in `services/`
- Common code in `common/`
- Shared types across all projects

### Progressive Web App
- Admin Dashboard is PWA-enabled
- Works offline with IDB caching
- Service worker support

### Database-Backend Pattern
- Next.js API routes directly access PostgreSQL
- Multiple DB utility modules for DDD-style organization
- Migration management via SQL files

### Real-time WebSocket Pattern
- Central WebSocket server
- Client-side subscription model
- Event validation & type safety

### Offline-First (Admin)
- IndexedDB for local caching
- Outbox pattern for violation syncing
- Conflict resolution with backend DB

---

## 9. DEPLOYMENT & RELEASE

### Build Pipeline
1. TypeScript compilation
2. Vite bundling (frontend)
3. Next.js build (backend)
4. Asset optimization

### Target Environments
- Development (localhost with hot reload)
- Staging (Vercel preview)
- Production (Vercel deployment)

### Configuration Management
- Environment-specific `.env` files
- Supabase project separation by environment
- API target proxying for development

---

## 10. PERFORMANCE OPTIMIZATIONS

- **Code Splitting:** Vite automatic
- **Tree Shaking:** ESNext modules
- **Lazy Loading:** React components with dynamic imports
- **PWA Caching:** Service workers
- **IndexedDB:** Reduces API calls for cached data
- **WebSocket:** Efficient real-time updates vs. polling

---

## Summary Statistics
- **Frontend Apps:** 2 (Admin Dashboard, Passenger Side)
- **Backend Services:** 2 (Next.js API, WebSocket Server)
- **Database:** PostgreSQL with ~20+ migration files
- **Languages:** TypeScript (primary), SQL
- **Total Dependencies:** ~40+ npm packages across all projects
- **Build Tools:** Vite (frontend), Next.js (backend)
- **Real-time Tech:** WebSocket + Supabase real-time
