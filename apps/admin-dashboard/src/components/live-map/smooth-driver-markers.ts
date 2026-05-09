import maplibregl from "maplibre-gl"

export type DriverMarkerOnlineStatus = "online" | "offline"

export type DriverMarkerCoordinate = {
  lng: number
  lat: number
}

export type DriverMarkerAppearance = {
  inside: boolean
  onlineStatus: DriverMarkerOnlineStatus
  bearing: number
}

export type SmoothDriverMarkerUpdate = {
  driverIdentifier: string
  aliases?: string[]
  position: DriverMarkerCoordinate
  timestamp: number
  accuracy?: number
  heading?: number
  speed?: number
  inside: boolean
  onlineStatus: DriverMarkerOnlineStatus
}

type DriverMarkerState = {
  driverIdentifier: string
  aliases: Set<string>
  marker: maplibregl.Marker
  displayedPosition: DriverMarkerCoordinate
  latestReceivedPosition: DriverMarkerCoordinate
  lastUpdateTimestamp: number
  animationFrameId: number | null
  bearing: number
  onlineStatus: DriverMarkerOnlineStatus
  inside: boolean
}

type SmoothDriverMarkerManagerOptions = {
  map: maplibregl.Map
  createMarkerElement: (
    driverIdentifier: string,
    appearance: DriverMarkerAppearance
  ) => HTMLDivElement
  getPopupContent?: (driverIdentifier: string) => HTMLElement
  updateMarkerElement?: (
    element: HTMLDivElement,
    appearance: DriverMarkerAppearance
  ) => void
}

type SmoothDriverMarkerResult = {
  accepted: boolean
  snapped: boolean
  position: DriverMarkerCoordinate | null
}

const MIN_ANIMATION_MS = 800
const MAX_ANIMATION_MS = 1500
const MAX_COORDINATE_ACCURACY_METERS = 100
const DUPLICATE_DISTANCE_METERS = 1.5
const SNAP_AFTER_IDLE_MS = 45_000
const RECONNECT_SNAP_DISTANCE_METERS = 250
const MAX_EXPECTED_SPEED_METERS_PER_SECOND = 35
const SPEED_DISTANCE_BUFFER_METERS = 35
const OUT_OF_ORDER_TOLERANCE_MS = 5_000

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const normalizeIdentifier = (value: string) => value.trim().toUpperCase()

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const isValidCoordinate = ({ lng, lat }: DriverMarkerCoordinate) =>
  isFiniteNumber(lng) && isFiniteNumber(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

const toDegrees = (radians: number) => (radians * 180) / Math.PI

const distanceMeters = (from: DriverMarkerCoordinate, to: DriverMarkerCoordinate) => {
  const earthRadiusMeters = 6_371_000
  const latDelta = toRadians(to.lat - from.lat)
  const lngDelta = toRadians(to.lng - from.lng)
  const fromLat = toRadians(from.lat)
  const toLat = toRadians(to.lat)

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusMeters * c
}

const normalizeBearing = (bearing: number) => ((bearing % 360) + 360) % 360

const calculateBearing = (from: DriverMarkerCoordinate, to: DriverMarkerCoordinate) => {
  const fromLat = toRadians(from.lat)
  const toLat = toRadians(to.lat)
  const lngDelta = toRadians(to.lng - from.lng)

  const y = Math.sin(lngDelta) * Math.cos(toLat)
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(lngDelta)

  if (x === 0 && y === 0) {
    return 0
  }

  return normalizeBearing(toDegrees(Math.atan2(y, x)))
}

const shortestBearingDelta = (from: number, to: number) => ((to - from + 540) % 360) - 180

const interpolateBearing = (from: number, to: number, progress: number) =>
  normalizeBearing(from + shortestBearingDelta(from, to) * progress)

const easeInOut = (value: number) =>
  value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2

const getAnimationDuration = (deltaMs: number) =>
  clamp(Math.round(deltaMs * 0.8), MIN_ANIMATION_MS, MAX_ANIMATION_MS)

const createMarkerAppearance = (state: DriverMarkerState): DriverMarkerAppearance => ({
  inside: state.inside,
  onlineStatus: state.onlineStatus,
  bearing: state.bearing
})

export const createSmoothDriverMarkerManager = ({
  map,
  createMarkerElement,
  getPopupContent,
  updateMarkerElement
}: SmoothDriverMarkerManagerOptions) => {
  const markersByDriver = new Map<string, DriverMarkerState>()
  const identifiersToDriver = new Map<string, string>()

  const syncPopupContent = (state: DriverMarkerState) => {
    if (!getPopupContent) return
    state.marker.getPopup()?.setDOMContent(getPopupContent(state.driverIdentifier))
  }

  const syncMarkerAppearance = (state: DriverMarkerState) => {
    updateMarkerElement?.(
      state.marker.getElement() as HTMLDivElement,
      createMarkerAppearance(state)
    )
  }

  const cancelAnimation = (state: DriverMarkerState) => {
    if (state.animationFrameId !== null) {
      window.cancelAnimationFrame(state.animationFrameId)
      state.animationFrameId = null
    }
  }

  const setMarkerPosition = (state: DriverMarkerState, position: DriverMarkerCoordinate) => {
    state.displayedPosition = position
    state.marker.setLngLat([position.lng, position.lat])
  }

  const resolveDriverIdentifier = (identifiers: string[]) => {
    for (const identifier of identifiers) {
      const normalized = normalizeIdentifier(identifier)
      const primary = identifiersToDriver.get(normalized)
      if (primary) return primary
    }
    return null
  }

  const registerIdentifiers = (state: DriverMarkerState, identifiers: string[]) => {
    for (const identifier of identifiers) {
      const normalized = normalizeIdentifier(identifier)
      if (!normalized) continue
      state.aliases.add(normalized)
      identifiersToDriver.set(normalized, state.driverIdentifier)
    }
  }

  const createState = (
    driverIdentifier: string,
    initialPosition: DriverMarkerCoordinate,
    initialTimestamp: number,
    inside: boolean,
    onlineStatus: DriverMarkerOnlineStatus,
    bearing: number,
    aliases: string[]
  ) => {
    const markerEl = createMarkerElement(driverIdentifier, {
      inside,
      onlineStatus,
      bearing
    })
    const marker = new maplibregl.Marker({ element: markerEl }).setLngLat([
      initialPosition.lng,
      initialPosition.lat
    ])

    if (getPopupContent) {
      marker.setPopup(
        new maplibregl.Popup({ offset: 12 }).setDOMContent(getPopupContent(driverIdentifier))
      )
    }

    marker.addTo(map)

    const state: DriverMarkerState = {
      driverIdentifier,
      aliases: new Set<string>(),
      marker,
      displayedPosition: initialPosition,
      latestReceivedPosition: initialPosition,
      lastUpdateTimestamp: initialTimestamp,
      animationFrameId: null,
      bearing,
      onlineStatus,
      inside
    }

    registerIdentifiers(state, [driverIdentifier, ...aliases])
    syncPopupContent(state)
    syncMarkerAppearance(state)
    markersByDriver.set(driverIdentifier, state)
    return state
  }

  const animateState = (
    state: DriverMarkerState,
    nextPosition: DriverMarkerCoordinate,
    nextBearing: number,
    durationMs: number
  ) => {
    cancelAnimation(state)

    const startPosition = state.displayedPosition
    const startBearing = state.bearing
    const startedAt = performance.now()

    const frame = (now: number) => {
      const elapsed = now - startedAt
      const progress = clamp(elapsed / durationMs, 0, 1)
      const eased = easeInOut(progress)

      setMarkerPosition(state, {
        lng: startPosition.lng + (nextPosition.lng - startPosition.lng) * eased,
        lat: startPosition.lat + (nextPosition.lat - startPosition.lat) * eased
      })
      state.bearing = interpolateBearing(startBearing, nextBearing, eased)
      syncMarkerAppearance(state)

      if (progress >= 1) {
        state.animationFrameId = null
        return
      }

      state.animationFrameId = window.requestAnimationFrame(frame)
    }

    state.animationFrameId = window.requestAnimationFrame(frame)
  }

  const upsert = ({
    driverIdentifier,
    aliases = [],
    position,
    timestamp,
    accuracy,
    heading,
    speed,
    inside,
    onlineStatus
  }: SmoothDriverMarkerUpdate): SmoothDriverMarkerResult => {
    if (!isValidCoordinate(position)) {
      return { accepted: false, snapped: false, position: null }
    }

    if (isFiniteNumber(accuracy) && accuracy > MAX_COORDINATE_ACCURACY_METERS) {
      return { accepted: false, snapped: false, position: null }
    }

    const normalizedDriverIdentifier = normalizeIdentifier(driverIdentifier)
    const resolvedDriverIdentifier =
      resolveDriverIdentifier([normalizedDriverIdentifier, ...aliases]) ?? normalizedDriverIdentifier

    let state = markersByDriver.get(resolvedDriverIdentifier)

    if (!state) {
      const bearing = isFiniteNumber(heading) ? normalizeBearing(heading) : 0
      state = createState(
        resolvedDriverIdentifier,
        position,
        timestamp,
        inside,
        onlineStatus,
        bearing,
        aliases
      )
      return {
        accepted: true,
        snapped: true,
        position: state.displayedPosition
      }
    }

    registerIdentifiers(state, [normalizedDriverIdentifier, ...aliases])

    if (timestamp < state.lastUpdateTimestamp - OUT_OF_ORDER_TOLERANCE_MS) {
      return { accepted: false, snapped: false, position: state.displayedPosition }
    }

    const duplicateDistance = distanceMeters(state.latestReceivedPosition, position)
    if (duplicateDistance <= DUPLICATE_DISTANCE_METERS) {
      state.lastUpdateTimestamp = Math.max(state.lastUpdateTimestamp, timestamp)
      state.onlineStatus = onlineStatus
      state.inside = inside
      syncPopupContent(state)
      syncMarkerAppearance(state)
      return {
        accepted: false,
        snapped: false,
        position: state.displayedPosition
      }
    }

    const displayedDistance = distanceMeters(state.displayedPosition, position)
    const gapMs = Math.max(0, timestamp - state.lastUpdateTimestamp)
    const shouldSnapForStaleGap = gapMs >= SNAP_AFTER_IDLE_MS
    const shouldSnapForFarReconnect =
      state.onlineStatus === "offline" && displayedDistance >= RECONNECT_SNAP_DISTANCE_METERS
    const shouldSnap = shouldSnapForStaleGap || shouldSnapForFarReconnect

    if (!shouldSnap) {
      const gapSeconds = Math.max(gapMs, 1_000) / 1_000
      const reportedSpeedMetersPerSecond = isFiniteNumber(speed) ? Math.max(speed, 0) : 0
      const allowedDistance =
        Math.max(MAX_EXPECTED_SPEED_METERS_PER_SECOND, reportedSpeedMetersPerSecond) * gapSeconds +
        SPEED_DISTANCE_BUFFER_METERS

      if (displayedDistance > allowedDistance) {
        return {
          accepted: false,
          snapped: false,
          position: state.displayedPosition
        }
      }
    }

    cancelAnimation(state)

    state.latestReceivedPosition = position
    state.lastUpdateTimestamp = Math.max(state.lastUpdateTimestamp, timestamp)
    state.onlineStatus = onlineStatus
    state.inside = inside
    syncPopupContent(state)

    const nextBearing =
      isFiniteNumber(heading) && displayedDistance > DUPLICATE_DISTANCE_METERS
        ? normalizeBearing(heading)
        : displayedDistance > DUPLICATE_DISTANCE_METERS
          ? calculateBearing(state.displayedPosition, position)
          : state.bearing

    if (shouldSnap) {
      state.bearing = nextBearing
      setMarkerPosition(state, position)
      syncMarkerAppearance(state)
      return {
        accepted: true,
        snapped: true,
        position: state.displayedPosition
      }
    }

    animateState(state, position, nextBearing, getAnimationDuration(gapMs))
    return {
      accepted: true,
      snapped: false,
      position
    }
  }

  const setOffline = (identifiers: string[], lastSeenTs?: number) => {
    const resolvedDriverIdentifier = resolveDriverIdentifier(identifiers)
    if (!resolvedDriverIdentifier) return

    const state = markersByDriver.get(resolvedDriverIdentifier)
    if (!state) return

    if (typeof lastSeenTs === "number" && Number.isFinite(lastSeenTs)) {
      state.lastUpdateTimestamp = Math.max(state.lastUpdateTimestamp, lastSeenTs)
    }
    state.onlineStatus = "offline"
    syncMarkerAppearance(state)
  }

  const remove = (identifiers: string[]) => {
    const resolvedDriverIdentifier = resolveDriverIdentifier(identifiers)
    if (!resolvedDriverIdentifier) return

    const state = markersByDriver.get(resolvedDriverIdentifier)
    if (!state) return

    cancelAnimation(state)
    state.marker.remove()
    markersByDriver.delete(resolvedDriverIdentifier)
    for (const identifier of state.aliases) {
      identifiersToDriver.delete(identifier)
    }
  }

  const getDisplayedPosition = (identifiers: string[]) => {
    const resolvedDriverIdentifier = resolveDriverIdentifier(identifiers)
    if (!resolvedDriverIdentifier) return null
    return markersByDriver.get(resolvedDriverIdentifier)?.displayedPosition ?? null
  }

  const destroy = () => {
    for (const state of markersByDriver.values()) {
      cancelAnimation(state)
      state.marker.remove()
    }
    markersByDriver.clear()
    identifiersToDriver.clear()
  }

  return {
    upsert,
    setOffline,
    remove,
    getDisplayedPosition,
    destroy
  }
}
