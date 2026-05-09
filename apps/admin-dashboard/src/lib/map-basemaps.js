"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRasterStyle = exports.getBasemapConfig = exports.MAP_STYLE_OPTIONS = exports.DEFAULT_MAP_STYLE = void 0;
var configuredTileUrl = (_a = import.meta.env.VITE_MAP_TILE_URL_TEMPLATE) === null || _a === void 0 ? void 0 : _a.trim();
var configuredAttribution = (_b = import.meta.env.VITE_MAP_ATTRIBUTION) === null || _b === void 0 ? void 0 : _b.trim();
var configuredMaxZoom = Number(import.meta.env.VITE_MAP_MAX_ZOOM);
var defaultStreetTileUrl = "https://api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}.png?key=nEWkXndWi3RnRssIeL7K";
var BASEMAPS = {
    street: {
        id: "street",
        label: "Street",
        tiles: [configuredTileUrl || defaultStreetTileUrl],
        tileSize: 256,
        maxZoom: Number.isFinite(configuredMaxZoom) ? configuredMaxZoom : 19,
        attribution: configuredAttribution ||
            '&copy; <a href="https://www.maptiler.com/" target="_blank" rel="noopener noreferrer">MapTiler</a> contributors'
    }
};
exports.DEFAULT_MAP_STYLE = "street";
exports.MAP_STYLE_OPTIONS = Object.values(BASEMAPS);
var getBasemapConfig = function (styleId) {
    var _a;
    if (styleId === void 0) { styleId = exports.DEFAULT_MAP_STYLE; }
    return (_a = BASEMAPS[styleId]) !== null && _a !== void 0 ? _a : BASEMAPS[exports.DEFAULT_MAP_STYLE];
};
exports.getBasemapConfig = getBasemapConfig;
var createRasterStyle = function (styleId) {
    var _a;
    var _b, _c, _d;
    if (styleId === void 0) { styleId = exports.DEFAULT_MAP_STYLE; }
    var basemap = (0, exports.getBasemapConfig)(styleId);
    return {
        version: 8,
        name: "triketrack-".concat(basemap.id),
        sources: (_a = {},
            _a[basemap.id] = {
                type: "raster",
                tiles: basemap.tiles,
                tileSize: (_b = basemap.tileSize) !== null && _b !== void 0 ? _b : 256,
                maxzoom: (_c = basemap.maxZoom) !== null && _c !== void 0 ? _c : 19,
                attribution: basemap.attribution
            },
            _a),
        layers: [
            {
                id: "".concat(basemap.id, "-layer"),
                type: "raster",
                source: basemap.id,
                minzoom: 0,
                maxzoom: (_d = basemap.maxZoom) !== null && _d !== void 0 ? _d : 19
            }
        ]
    };
};
exports.createRasterStyle = createRasterStyle;
