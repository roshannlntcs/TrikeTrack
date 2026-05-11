type ReverseGeocodeOptions = {
  latitude: number
  longitude: number
  fallbackLabel?: string
}

type NominatimResponse = {
  display_name?: string
  name?: string
  address?: Record<string, string | undefined>
}

const cache = new Map<string, string>()

const coordinateCacheKey = (latitude: number, longitude: number) =>
  `${latitude.toFixed(5)},${longitude.toFixed(5)}`

const compactDisplayName = (payload: NominatimResponse) => {
  const address = payload.address ?? {}
  const street =
    address.road ??
    address.pedestrian ??
    address.footway ??
    address.path ??
    address.neighbourhood ??
    payload.name
  const barangay =
    address.suburb ??
    address.village ??
    address.hamlet ??
    address.quarter ??
    address.neighbourhood
  const district = address.city_district ?? address.county
  const city = address.city ?? address.town ?? address.municipality

  const parts = [street, barangay, district, city]
    .map((part) => part?.trim())
    .filter((part, index, all): part is string =>
      Boolean(part) && all.findIndex((candidate) => candidate?.toLowerCase() === part?.toLowerCase()) === index
    )

  if (parts.length > 0) {
    return parts.join(", ")
  }

  return payload.display_name?.split(",").slice(0, 4).join(",").trim()
}

export const reverseGeocodeLocationName = async ({
  latitude,
  longitude,
  fallbackLabel
}: ReverseGeocodeOptions) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return fallbackLabel
  }

  const key = coordinateCacheKey(latitude, longitude)
  const cached = cache.get(key)
  if (cached) return cached

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3500)

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse")
    url.searchParams.set("format", "jsonv2")
    url.searchParams.set("lat", String(latitude))
    url.searchParams.set("lon", String(longitude))
    url.searchParams.set("zoom", "18")
    url.searchParams.set("addressdetails", "1")

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TrikeTrack/1.0 location display"
      }
    })

    if (!response.ok) return fallbackLabel

    const payload = (await response.json().catch(() => null)) as NominatimResponse | null
    const label = payload ? compactDisplayName(payload) : undefined
    if (label) {
      cache.set(key, label)
      return label
    }
  } catch {
    return fallbackLabel
  } finally {
    clearTimeout(timeoutId)
  }

  return fallbackLabel
}
