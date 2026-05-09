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
const BREADCRUMB_SOURCE_ID = "triketrack-breadcrumbs"
const BREADCRUMB_LAYER_ID = "triketrack-breadcrumbs-layer"
const ROUTE_SOURCE_ID = "triketrack-route"
const ROUTE_LAYER_ID = "triketrack-route-layer"

type TriketrackMapProps = {
  currentLocation?: TriketrackMapCoordinate | null
  destination?: TriketrackMapCoordinate | null
  breadcrumbPoints?: TriketrackMapCoordinate[]
  routeCoordinates?: Array<[number, number]>
  mapStyle?: TriketrackMapStyleId
  showControls?: boolean
  showStyleSwitcher?: boolean
  showLocateButton?: boolean
  onLocationUpdate?: (location: TriketrackMapCoordinate) => void
  viewportPadding?:
    | number
    | {
        top: number
        right: number
        bottom: number
        left: number
      }
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

const createLineStringFeature = (coordinates: Array<[number, number]>) => ({
  type: "Feature" as const,
  properties: {},
  geometry: {
    type: "LineString" as const,
    coordinates
  }
})

const createPointFeatureCollection = (points: TriketrackMapCoordinate[]) => ({
  type: "FeatureCollection" as const,
  features: points.map((point) => ({
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Point" as const,
      coordinates: toLngLat(point)
    }
  }))
})

export function TriketrackMap({
  currentLocation,
  destination,
  breadcrumbPoints = [],
  routeCoordinates = [],
  mapStyle = DEFAULT_MAP_STYLE,
  showControls = true,
  showStyleSwitcher = true,
  showLocateButton = true,
  onLocationUpdate,
  viewportPadding = FIT_BOUNDS_PADDING,
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
  }, [showControls, selectedStyle])

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

    const existingSource = map.getSource(BREADCRUMB_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    const nextData = createPointFeatureCollection(breadcrumbPoints)

    if (!existingSource) {
      map.addSource(BREADCRUMB_SOURCE_ID, {
        type: "geojson",
        data: nextData
      })
      map.addLayer({
        id: BREADCRUMB_LAYER_ID,
        type: "circle",
        source: BREADCRUMB_SOURCE_ID,
        paint: {
          "circle-radius": 3.5,
          "circle-color": "#0b5cff",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.9
        }
      })
      return
    }

    existingSource.setData(nextData)
  }, [breadcrumbPoints, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const existingSource = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    const nextData = createLineStringFeature(routeCoordinates)

    if (!existingSource) {
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: nextData
      })
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round"
        },
        paint: {
          "line-color": "#16a34a",
          "line-width": 4,
          "line-opacity": 0.82
        }
      })
      return
    }

    existingSource.setData(nextData)
  }, [mapReady, routeCoordinates])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (effectiveCurrentLocation && destination) {
      const bounds = new maplibregl.LngLatBounds()
      bounds.extend(toLngLat(effectiveCurrentLocation))
      bounds.extend(toLngLat(destination))
      map.fitBounds(bounds, {
        padding: viewportPadding,
        maxZoom: 16,
        duration: 700
      })
      hasAutoCenteredRef.current = true
      return
    }

    if (routeCoordinates.length > 1) {
      const bounds = new maplibregl.LngLatBounds()
      for (const coordinate of routeCoordinates) {
        bounds.extend(coordinate)
      }
      if (effectiveCurrentLocation) {
        bounds.extend(toLngLat(effectiveCurrentLocation))
      }
      map.fitBounds(bounds, {
        padding: viewportPadding,
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
        padding: viewportPadding,
        essential: true,
        duration: 700
      })
      hasAutoCenteredRef.current = true
    }
  }, [destination, effectiveCurrentLocation, mapReady, routeCoordinates])

  const handleLocateClick = async () => {
    const location = await liveLocationState.locate()
    const map = mapRef.current
    if (!map || !location) return

    map.flyTo({
      center: toLngLat(location),
      zoom: Math.max(map.getZoom(), 15.5),
      padding: viewportPadding,
      essential: true,
      duration: 700
    })
  }

  const rootClassName = className
    ? `triketrack-map ${className}`
    : "triketrack-map"

  return (
    <section className={rootClassName} aria-label="Trip map">
      {(showStyleSwitcher || (showLocateButton && liveLocationState.supported)) && (
        <div className="triketrack-map__toolbar">
          {showStyleSwitcher && (
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
          )}

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
      )}

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
