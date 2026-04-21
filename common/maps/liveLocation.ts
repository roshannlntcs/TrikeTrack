import { useEffect, useState } from "react"

export type TriketrackMapCoordinate = {
  latitude: number
  longitude: number
  accuracy?: number
  heading?: number | null
  timestamp?: number
}

type UseLiveLocationOptions = {
  enabled?: boolean
  onLocationUpdate?: (location: TriketrackMapCoordinate) => void
}

type LiveLocationState = {
  location: TriketrackMapCoordinate | null
  loading: boolean
  error: string | null
  supported: boolean
  locate: () => Promise<TriketrackMapCoordinate | null>
}

const toLocation = (
  position: GeolocationPosition
): TriketrackMapCoordinate => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: position.coords.accuracy,
  heading:
    typeof position.coords.heading === "number" && Number.isFinite(position.coords.heading)
      ? position.coords.heading
      : null,
  timestamp: position.timestamp
})

const getErrorMessage = (error: GeolocationPositionError) => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location access was denied."
    case error.POSITION_UNAVAILABLE:
      return "Current location is unavailable."
    case error.TIMEOUT:
      return "Location request timed out."
    default:
      return "Unable to get the current location."
  }
}

export const useLiveLocation = ({
  enabled = true,
  onLocationUpdate
}: UseLiveLocationOptions = {}): LiveLocationState => {
  const [location, setLocation] = useState<TriketrackMapCoordinate | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    if (!("geolocation" in navigator)) {
      setLoading(false)
      setError("Geolocation is not supported on this device.")
      return
    }

    let active = true
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!active) return
        const nextLocation = toLocation(position)
        setLocation(nextLocation)
        setLoading(false)
        setError(null)
        onLocationUpdate?.(nextLocation)
      },
      (watchError) => {
        if (!active) return
        setLoading(false)
        setError(getErrorMessage(watchError))
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000
      }
    )

    return () => {
      active = false
      navigator.geolocation.clearWatch(watchId)
    }
  }, [enabled, onLocationUpdate])

  const locate = async () => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported on this device.")
      return null
    }

    setLoading(true)

    return new Promise<TriketrackMapCoordinate | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation = toLocation(position)
          setLocation(nextLocation)
          setLoading(false)
          setError(null)
          onLocationUpdate?.(nextLocation)
          resolve(nextLocation)
        },
        (locateError) => {
          setLoading(false)
          setError(getErrorMessage(locateError))
          resolve(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000
        }
      )
    })
  }

  return {
    location,
    loading,
    error,
    supported: "geolocation" in navigator,
    locate
  }
}
