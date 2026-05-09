import type { StyleSpecification } from "maplibre-gl"

export type TriketrackMapStyleId = "street"

type BasemapConfig = {
  id: TriketrackMapStyleId
  label: string
  tiles: string[]
  tileSize?: number
  maxZoom?: number
  attribution: string
}

const configuredTileUrl = import.meta.env.VITE_MAP_TILE_URL_TEMPLATE?.trim()
const configuredAttribution = import.meta.env.VITE_MAP_ATTRIBUTION?.trim()
const configuredMaxZoom = Number(import.meta.env.VITE_MAP_MAX_ZOOM)
const defaultStreetTileUrl =
  "https://api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}.png?key=nEWkXndWi3RnRssIeL7K"

const BASEMAPS: Record<TriketrackMapStyleId, BasemapConfig> = {
  street: {
    id: "street",
    label: "Street",
    tiles: [configuredTileUrl || defaultStreetTileUrl],
    tileSize: 256,
    maxZoom: Number.isFinite(configuredMaxZoom) ? configuredMaxZoom : 19,
    attribution:
      configuredAttribution ||
      '&copy; <a href="https://www.maptiler.com/" target="_blank" rel="noopener noreferrer">MapTiler</a> contributors'
  }
}

export const DEFAULT_MAP_STYLE: TriketrackMapStyleId = "street"

export const MAP_STYLE_OPTIONS = Object.values(BASEMAPS)

export const getBasemapConfig = (
  styleId: TriketrackMapStyleId = DEFAULT_MAP_STYLE
) => BASEMAPS[styleId] ?? BASEMAPS[DEFAULT_MAP_STYLE]

export const createRasterStyle = (
  styleId: TriketrackMapStyleId = DEFAULT_MAP_STYLE
): StyleSpecification => {
  const basemap = getBasemapConfig(styleId)

  return {
    version: 8,
    name: `triketrack-${basemap.id}`,
    sources: {
      [basemap.id]: {
        type: "raster",
        tiles: basemap.tiles,
        tileSize: basemap.tileSize ?? 256,
        maxzoom: basemap.maxZoom ?? 19,
        attribution: basemap.attribution
      }
    },
    layers: [
      {
        id: `${basemap.id}-layer`,
        type: "raster",
        source: basemap.id,
        minzoom: 0,
        maxzoom: basemap.maxZoom ?? 19
      }
    ]
  }
}
