import { useEffect, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import "./TriketrackMap.css"
import {
  createRasterStyle,
  DEFAULT_MAP_STYLE,
  MAP_STYLE_OPTIONS,
  type TriketrackMapStyleId
} from "./basemaps"
import {
  useLiveLocation,
  type TriketrackMapCoordinate
} from "./liveLocation"
import { createCurrentLocationMarker, createDestinationMarker } from "./markers"

const DEFAULT_CENTER: [number, number] = [125.6128, 7.0848]
const DEFAULT_ZOOM = 13
const FIT_BOUNDS_PADDING = 72

type TriketrackMapProps = {
  currentLocation?: TriketrackMapCoordinate | null
  destination?: TriketrackMapCoordinate | null
  mapStyle?: TriketrackMapStyleId
  showControls?: boolean
  showLocateButton?: boolean
  onLocationUpdate?: (location: TriketrackMapCoordinate) => void
  className?: string
}

const LocateIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 3.75v3m0 10.5v3m8.25-8.25h-3M6.75 12h-3m12.45 0a5.2 5.2 0 1 1-10.4 0 5.2 5.2 0 0 1 10.4 0Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
)

const toLngLat = (point: TriketrackMapCoordinate): [number, number] => [
  point.longitude,
  point.latitude
]

export function TriketrackMap({
  currentLocation,
  destination,
  mapStyle = DEFAULT_MAP_STYLE,
  showControls = true,
  showLocateButton = true,
  onLocationUpdate,
  className
}: TriketrackMapProps) {
  const mapRootRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const currentMarkerRef = useRef<maplibregl.Marker | null>(null)
  const destinationMarkerRef = useRef<maplibregl.Marker | null>(null)
  const hasAutoCenteredRef = useRef(false)
  const [selectedStyle, setSelectedStyle] = useState<TriketrackMapStyleId>(mapStyle)
  const [mapReady, setMapReady] = useState(false)

  const liveLocationState = useLiveLocation({
    enabled: !currentLocation || showLocateButton || Boolean(onLocationUpdate),
    onLocationUpdate
  })

  const effectiveCurrentLocation = currentLocation ?? liveLocationState.location

  useEffect(() => {
    setSelectedStyle(mapStyle)
  }, [mapStyle])

  useEffect(() => {
    if (!mapRootRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapRootRef.current,
      style: createRasterStyle(selectedStyle),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM
    })

    if (showControls) {
      map.addControl(
        new maplibregl.NavigationControl({
          showCompass: false,
          visualizePitch: false
        }),
        "top-right"
      )
    }

    map.on("load", () => {
      setMapReady(true)
    })

    map.on("error", (event: unknown) => {
      console.error("MapLibre error:", (event as { error?: unknown }).error ?? event)
    })

    mapRef.current = map

    return () => {
      currentMarkerRef.current?.remove()
      destinationMarkerRef.current?.remove()
      map.remove()
      mapRef.current = null
      currentMarkerRef.current = null
      destinationMarkerRef.current = null
    }
  }, [showControls])

  useEffect(() => {
    if (!mapRootRef.current || !mapRef.current || typeof ResizeObserver === "undefined") return

    const resizeObserver = new ResizeObserver(() => {
      mapRef.current?.resize()
    })

    resizeObserver.observe(mapRootRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.setStyle(createRasterStyle(selectedStyle))
    setMapReady(false)

    const handleStyleData = () => {
      setMapReady(true)
    }

    map.once("styledata", handleStyleData)

    return () => {
      map.off("styledata", handleStyleData)
    }
  }, [selectedStyle])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !effectiveCurrentLocation) return

    if (!currentMarkerRef.current) {
      currentMarkerRef.current = new maplibregl.Marker({
        element: createCurrentLocationMarker()
      })
        .setLngLat(toLngLat(effectiveCurrentLocation))
        .addTo(map)
    } else {
      currentMarkerRef.current.setLngLat(toLngLat(effectiveCurrentLocation))
    }
  }, [effectiveCurrentLocation, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (!destination) {
      destinationMarkerRef.current?.remove()
      destinationMarkerRef.current = null
      return
    }

    if (!destinationMarkerRef.current) {
      destinationMarkerRef.current = new maplibregl.Marker({
        element: createDestinationMarker(),
        offset: [0, -10]
      })
        .setLngLat(toLngLat(destination))
        .addTo(map)
    } else {
      destinationMarkerRef.current.setLngLat(toLngLat(destination))
    }
  }, [destination, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (effectiveCurrentLocation && destination) {
      const bounds = new maplibregl.LngLatBounds()
      bounds.extend(toLngLat(effectiveCurrentLocation))
      bounds.extend(toLngLat(destination))
      map.fitBounds(bounds, {
        padding: FIT_BOUNDS_PADDING,
        maxZoom: 16,
        duration: 700
      })
      hasAutoCenteredRef.current = true
      return
    }

    if (effectiveCurrentLocation && !hasAutoCenteredRef.current) {
      map.flyTo({
        center: toLngLat(effectiveCurrentLocation),
        zoom: 15.5,
        essential: true,
        duration: 700
      })
      hasAutoCenteredRef.current = true
    }
  }, [destination, effectiveCurrentLocation, mapReady])

  const handleLocateClick = async () => {
    const location = await liveLocationState.locate()
    const map = mapRef.current
    if (!map || !location) return

    map.flyTo({
      center: toLngLat(location),
      zoom: Math.max(map.getZoom(), 15.5),
      essential: true,
      duration: 700
    })
  }

  const rootClassName = className
    ? `triketrack-map ${className}`
    : "triketrack-map"

  return (
    <section className={rootClassName} aria-label="Trip map">
      <div className="triketrack-map__toolbar">
        <div className="triketrack-map__style-switcher" role="tablist" aria-label="Map style">
          {MAP_STYLE_OPTIONS.map((option) => {
            const active = selectedStyle === option.id
            return (
              <button
                key={option.id}
                type="button"
                className={`triketrack-map__style-button${
                  active ? " triketrack-map__style-button--active" : ""
                }`}
                onClick={() => setSelectedStyle(option.id)}
                role="tab"
                aria-selected={active}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        {showLocateButton && liveLocationState.supported && (
          <button
            type="button"
            className="triketrack-map__locate-button"
            onClick={() => void handleLocateClick()}
            aria-label="Center map on current location"
          >
            <LocateIcon />
            <span>Locate</span>
          </button>
        )}
      </div>

      <div ref={mapRootRef} className="triketrack-map__canvas" />

      <div className="triketrack-map__status">
        {!effectiveCurrentLocation && liveLocationState.loading && (
          <div className="triketrack-map__status-pill triketrack-map__status-pill--loading">
            Locating current position...
          </div>
        )}

        {liveLocationState.error && (
          <div className="triketrack-map__status-pill triketrack-map__status-pill--error">
            {liveLocationState.error} <span className="triketrack-map__hint">Map remains usable.</span>
          </div>
        )}
      </div>
    </section>
  )
}

export type { TriketrackMapProps, TriketrackMapCoordinate, TriketrackMapStyleId }
