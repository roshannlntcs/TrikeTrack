/**
 * OSRM Map Matching Service
 * 
 * Converts raw GPS points to road-matched route geometry using OSRM.
 * This ensures the trip route follows actual roads instead of drawing straight lines.
 */

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org"

interface InputCoordinate {
  latitude: number
  longitude: number
  timestamp?: number
}

interface OSRMMatchResponse {
  code: string
  matchings: Array<{
    confidence: number
    geometry: {
      coordinates: Array<[number, number]>
      type: string
    }
    legs: Array<{
      steps: unknown[]
      distance: number
      duration: number
      summary: string
    }>
    distance: number
    duration: number
  }>
  tracepoints: Array<{
    hint: string
    distance: number
    name: string
    location: [number, number]
  } | null>
}

/**
 * Convert GPS coordinates to OSRM match format [lng, lat]
 */
function formatCoordinatesForOSRM(points: InputCoordinate[]): Array<[number, number]> {
  return points.map((p) => [p.longitude, p.latitude])
}

/**
 * Call OSRM Map Matching API
 */
async function callOSRMMatchingAPI(
  coordinates: Array<[number, number]>
): Promise<OSRMMatchResponse> {
  const coordString = coordinates.map((c) => `${c[0]},${c[1]}`).join(";")
  const url = `${OSRM_BASE_URL}/match/v1/driving/${coordString}?steps=false&geometries=geojson&overview=full&annotations=duration,distance`

  const response = await fetch(url, {
    headers: { "User-Agent": "TrikeTrack/1.0" }
  })

  if (!response.ok) {
    throw new Error(`OSRM API returned status ${response.status}: ${response.statusText}`)
  }

  const data = (await response.json()) as OSRMMatchResponse
  if (data.code !== "Ok") {
    throw new Error(`OSRM returned error code: ${data.code}`)
  }

  return data
}

/**
 * Extract matched route geometry from OSRM response
 */
function extractMatchedGeometry(matchResponse: OSRMMatchResponse): {
  coordinates: Array<[number, number]>
  pointCount: number
} | null {
  if (!matchResponse.matchings || matchResponse.matchings.length === 0) {
    return null
  }

  const firstMatching = matchResponse.matchings[0]
  const coordinates = firstMatching.geometry.coordinates

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null
  }

  return {
    coordinates,
    pointCount: coordinates.length
  }
}

/**
 * Match raw GPS points to road network using OSRM
 * 
 * @param gpsPoints - Array of GPS coordinates (latitude, longitude)
 * @returns GeoJSON Feature with matched route geometry, or null if matching fails
 */
export async function matchTripGPSToRoads(
  gpsPoints: InputCoordinate[]
): Promise<{
  type: "Feature"
  geometry: {
    type: "LineString"
    coordinates: Array<[number, number]>
  }
  properties: {
    source: "osrm_matched_route"
    pointCount: number
    matchedAt: string
  }
} | null> {
  if (!Array.isArray(gpsPoints) || gpsPoints.length < 2) {
    throw new Error("At least 2 GPS points are required for map matching")
  }

  // Limit to max 100 points per OSRM request (API constraint)
  const maxPoints = 100
  const pointsToMatch = gpsPoints.slice(0, maxPoints)

  const osrmCoordinates = formatCoordinatesForOSRM(pointsToMatch)

  const matchResponse = await callOSRMMatchingAPI(osrmCoordinates)
  const matched = extractMatchedGeometry(matchResponse)

  if (!matched) {
    return null
  }

  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: matched.coordinates
    },
    properties: {
      source: "osrm_matched_route",
      pointCount: matched.coordinates.length,
      matchedAt: new Date().toISOString()
    }
  }
}

/**
 * Validate if a set of GPS points is worth matching
 * Returns false if points are too sparse or clustered
 */
export function shouldAttemptMatching(gpsPoints: InputCoordinate[]): boolean {
  if (gpsPoints.length < 2) return false
  if (gpsPoints.length > 500) return false // Too many points might be noise

  // Allow OSRM matching for all trips with at least two distinct GPS points.
  // Short trips may still be mapped to roads and should not be rejected solely
  // because they are under a specific distance threshold.
  const uniquePoints = new Set(
    gpsPoints.map((point) => `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`)
  )
  return uniquePoints.size >= 2
}
