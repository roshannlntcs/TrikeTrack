import type { StyleSpecification } from "maplibre-gl"

export type TriketrackMapStyleId = "street" | "satellite" | "terrain"

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

const BASEMAPS: Record<TriketrackMapStyleId, BasemapConfig> = {
  street: {
    id: "street",
    label: "Street",
    tiles: [configuredTileUrl || "https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    tileSize: 256,
    maxZoom: Number.isFinite(configuredMaxZoom) ? configuredMaxZoom : 19,
    attribution:
      configuredAttribution ||
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
  },
  satellite: {
    id: "satellite",
    label: "Satellite",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    ],
    tileSize: 256,
    maxZoom: 19,
    attribution:
      'Tiles &copy; <a href="https://www.esri.com/en-us/home" target="_blank" rel="noopener noreferrer">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community'
  },
  terrain: {
    id: "terrain",
    label: "Terrain",
    tiles: ["https://tile.opentopomap.org/{z}/{x}/{y}.png"],
    tileSize: 256,
    maxZoom: 17,
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors, ' +
      '<a href="https://viewfinderpanoramas.org/" target="_blank" rel="noopener noreferrer">SRTM</a> | ' +
      'Map style: &copy; <a href="https://opentopomap.org/" target="_blank" rel="noopener noreferrer">OpenTopoMap</a>'
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
