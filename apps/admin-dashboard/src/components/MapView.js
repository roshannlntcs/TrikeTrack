"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MapView;
var react_1 = require("react");
var maplibre_gl_1 = require("maplibre-gl");
var turf = require("@turf/turf");
var geofence_geojson_raw_1 = require("../data/geofence.geojson?raw");
var db_1 = require("../lib/db");
var outbox_1 = require("../lib/outbox");
var TripLogs_1 = require("./TripLogs");
var MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
var OBRERO_CENTER = [125.6128, 7.0848];
var DEFAULT_CITY_ZOOM = 11;
var WORLD_MIN_ZOOM = 1;
var GEOFENCE_FIT_PADDING = 28;
var GEOFENCE_FOCUS_MAX_ZOOM = 13.5;
var DRIVER_OFFLINE_MS = 15000;
var getGeofenceBounds = function (geofenceFeature) {
    var _a = turf.bbox(geofenceFeature), minLng = _a[0], minLat = _a[1], maxLng = _a[2], maxLat = _a[3];
    return [
        [minLng, minLat],
        [maxLng, maxLat]
    ];
};
function MapView() {
    var _this = this;
    var el = (0, react_1.useRef)(null);
    var _a = (0, react_1.useState)("connecting"), syncStatus = _a[0], setSyncStatus = _a[1];
    var _b = (0, react_1.useState)(null), lastUpdateTs = _b[0], setLastUpdateTs = _b[1];
    var _c = (0, react_1.useState)(navigator.onLine), online = _c[0], setOnline = _c[1];
    var _d = (0, react_1.useState)(0), outboxCount = _d[0], setOutboxCount = _d[1];
    var _e = (0, react_1.useState)("idle"), outboxStatus = _e[0], setOutboxStatus = _e[1];
    (0, react_1.useEffect)(function () {
        if (!el.current)
            return;
        var geofence = JSON.parse(geofence_geojson_raw_1.default);
        var OUTBOX_SYNC_MS = 5000;
        var VIOLATION_SYNC_ENDPOINT = import.meta.env.VITE_VIOLATIONS_ENDPOINT || "/api/violations/batch";
        var map = new maplibre_gl_1.default.Map({
            container: el.current,
            style: MAP_STYLE_URL,
            center: OBRERO_CENTER,
            zoom: DEFAULT_CITY_ZOOM,
            minZoom: WORLD_MIN_ZOOM,
            maxZoom: 19,
            renderWorldCopies: true
        });
        map.addControl(new maplibre_gl_1.default.NavigationControl({
            showCompass: false,
            visualizePitch: false
        }), "top-right");
        map.on("error", function (e) {
            console.error("MapLibre error:", (e === null || e === void 0 ? void 0 : e.error) || e);
        });
        var reconnectTimer;
        var socket = null;
        var active = true;
        var onlineHandler = null;
        var outboxTimer;
        var outboxOnlineHandler = null;
        var stalePresenceTimer;
        var markers = new Map();
        var lastSeenByDriver = new Map();
        var refreshOutboxCount = function () { return __awaiter(_this, void 0, void 0, function () {
            var count, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, db_1.getOutboxCount)()];
                    case 1:
                        count = _a.sent();
                        if (active)
                            setOutboxCount(count);
                        return [3 /*break*/, 3];
                    case 2:
                        err_1 = _a.sent();
                        console.warn("Outbox count failed:", err_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); };
        var runOutboxSync = function () { return __awaiter(_this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!active)
                            return [2 /*return*/];
                        if (!!navigator.onLine) return [3 /*break*/, 2];
                        setOutboxStatus("offline");
                        return [4 /*yield*/, refreshOutboxCount()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                    case 2:
                        setOutboxStatus("syncing");
                        return [4 /*yield*/, (0, outbox_1.syncOutbox)(VIOLATION_SYNC_ENDPOINT)];
                    case 3:
                        result = _a.sent();
                        return [4 /*yield*/, refreshOutboxCount()];
                    case 4:
                        _a.sent();
                        if (!active)
                            return [2 /*return*/];
                        if (result.failed > 0) {
                            setOutboxStatus("error");
                        }
                        else {
                            setOutboxStatus("idle");
                        }
                        return [2 /*return*/];
                }
            });
        }); };
        var createMarkerElement = function (color) {
            var markerEl = document.createElement("div");
            markerEl.style.width = "14px";
            markerEl.style.height = "14px";
            markerEl.style.borderRadius = "50%";
            markerEl.style.background = color;
            markerEl.style.border = "2px solid #ffffff";
            markerEl.style.boxShadow = "0 2px 6px rgba(0,0,0,0.35)";
            return markerEl;
        };
        var pruneStaleMarkers = function () {
            var now = Date.now();
            for (var _i = 0, _a = lastSeenByDriver.entries(); _i < _a.length; _i++) {
                var _b = _a[_i], driverId = _b[0], lastSeenTs = _b[1];
                if (now - lastSeenTs <= DRIVER_OFFLINE_MS)
                    continue;
                var marker = markers.get(driverId);
                if (marker) {
                    marker.remove();
                    markers.delete(driverId);
                }
                lastSeenByDriver.delete(driverId);
            }
        };
        var toDriverLocationEvent = function (payload) {
            if (!payload || typeof payload !== "object")
                return null;
            var raw = payload;
            var isFiniteNumber = function (value) {
                return typeof value === "number" && Number.isFinite(value);
            };
            var isString = function (value) {
                return typeof value === "string" && value.trim().length > 0;
            };
            if (raw.type !== "driver_location")
                return null;
            if (!isString(raw.driverId))
                return null;
            if (!isFiniteNumber(raw.ts))
                return null;
            if (!isFiniteNumber(raw.lng) || !isFiniteNumber(raw.lat))
                return null;
            if (raw.speed !== undefined && !isFiniteNumber(raw.speed))
                return null;
            if (raw.heading !== undefined && !isFiniteNumber(raw.heading))
                return null;
            if (raw.accuracy !== undefined && !isFiniteNumber(raw.accuracy))
                return null;
            if (raw.tripId !== undefined && !isString(raw.tripId))
                return null;
            return {
                type: "driver_location",
                driverId: raw.driverId,
                ts: raw.ts,
                lng: raw.lng,
                lat: raw.lat,
                speed: raw.speed,
                heading: raw.heading,
                accuracy: raw.accuracy,
                tripId: raw.tripId
            };
        };
        map.on("load", function () {
            var _a, _b, _c, _d, _e;
            console.log("MAP LOADED");
            var geofencePolygon = (_a = geofence.features) === null || _a === void 0 ? void 0 : _a.find(function (feature) { var _a; return ((_a = feature.geometry) === null || _a === void 0 ? void 0 : _a.type) === "Polygon"; });
            if (!geofencePolygon) {
                console.error("geofence.geojson is missing a Polygon feature.");
                return;
            }
            var polygonRing = (_c = (_b = geofencePolygon.geometry) === null || _b === void 0 ? void 0 : _b.coordinates) === null || _c === void 0 ? void 0 : _c[0];
            if (!Array.isArray(polygonRing) || polygonRing.length < 4) {
                console.error("geofence.geojson Polygon ring must have at least 4 coordinates.");
                return;
            }
            map.fitBounds(getGeofenceBounds(geofencePolygon), {
                padding: GEOFENCE_FIT_PADDING,
                duration: 0,
                maxZoom: GEOFENCE_FOCUS_MAX_ZOOM
            });
            var geofencePolyline = (_e = (_d = geofence.features) === null || _d === void 0 ? void 0 : _d.find(function (feature) { var _a; return ((_a = feature.geometry) === null || _a === void 0 ? void 0 : _a.type) === "LineString"; })) !== null && _e !== void 0 ? _e : turf.polygonToLine(geofencePolygon);
            map.addSource("area-geofence", {
                type: "geojson",
                data: geofencePolygon
            });
            map.addLayer({
                id: "area-geofence-fill",
                type: "fill",
                source: "area-geofence",
                paint: {
                    "fill-color": "#0ea5e9",
                    "fill-opacity": 0.12
                }
            });
            map.addLayer({
                id: "area-geofence-outline",
                type: "line",
                source: "area-geofence",
                paint: {
                    "line-color": "#0284c7",
                    "line-width": 2,
                    "line-opacity": 0.9
                }
            });
            map.addSource("geofence-boundary", {
                type: "geojson",
                data: geofencePolyline
            });
            map.addLayer({
                id: "geofence-boundary-line",
                type: "line",
                source: "geofence-boundary",
                paint: {
                    "line-color": "#2563eb",
                    "line-width": 4,
                    "line-opacity": 0.95
                }
            });
            var updateMarker = function (event) { return __awaiter(_this, void 0, void 0, function () {
                var inside, color, existing, el_1, markerEl, marker;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            lastSeenByDriver.set(event.driverId, event.ts);
                            inside = turf.booleanPointInPolygon(turf.point([event.lng, event.lat]), geofencePolygon);
                            color = inside ? "#2563eb" : "#ef4444";
                            existing = markers.get(event.driverId);
                            if (existing) {
                                existing.setLngLat([event.lng, event.lat]);
                                el_1 = existing.getElement();
                                el_1.style.background = color;
                            }
                            else {
                                markerEl = createMarkerElement(color);
                                marker = new maplibre_gl_1.default.Marker({ element: markerEl })
                                    .setLngLat([event.lng, event.lat])
                                    .setPopup(new maplibre_gl_1.default.Popup({ offset: 12 }).setText(event.driverId))
                                    .addTo(map);
                                markers.set(event.driverId, marker);
                            }
                            if (!!inside) return [3 /*break*/, 3];
                            console.warn("VIOLATION: outside geofence boundary", {
                                id: event.driverId,
                                lng: event.lng,
                                lat: event.lat
                            });
                            return [4 /*yield*/, (0, db_1.enqueueViolation)({
                                    driverId: event.driverId,
                                    ts: event.ts,
                                    lng: event.lng,
                                    lat: event.lat,
                                    routeId: "umasa-brgy-18b-geofence",
                                    reason: "OUTSIDE_ROUTE_CORRIDOR",
                                    speed: event.speed,
                                    heading: event.heading,
                                    accuracy: event.accuracy
                                })];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, refreshOutboxCount()];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3: return [4 /*yield*/, (0, db_1.savePoint)({
                                driverId: event.driverId,
                                ts: event.ts,
                                lng: event.lng,
                                lat: event.lat,
                                speed: event.speed,
                                heading: event.heading,
                                accuracy: event.accuracy,
                                tripId: event.tripId,
                                violation: !inside
                            })];
                        case 4:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); };
            var WS_URL = import.meta.env.VITE_WS_URL ||
                "".concat(window.location.protocol === "https:" ? "wss" : "ws", "://").concat(window.location.host, "/ws");
            console.log("WS URL:", import.meta.env.VITE_WS_URL);
            var connectSocket = function () {
                if (!active)
                    return;
                if (socket && socket.readyState === WebSocket.OPEN)
                    return;
                if (socket && socket.readyState === WebSocket.CONNECTING)
                    return;
                setSyncStatus("connecting");
                socket = new WebSocket(WS_URL);
                socket.onopen = function () {
                    console.log("ADMIN WS connected");
                    setSyncStatus("connected");
                };
                socket.onclose = function () {
                    console.log("ADMIN WS closed");
                    setSyncStatus("disconnected");
                    if (reconnectTimer)
                        window.clearTimeout(reconnectTimer);
                    if (navigator.onLine) {
                        reconnectTimer = window.setTimeout(connectSocket, 3000);
                    }
                };
                socket.onerror = function (event) {
                    console.log("ADMIN WS error", event);
                    setSyncStatus("disconnected");
                };
                socket.onmessage = function (event) {
                    console.log("ADMIN WS message", event.data);
                    if (!active)
                        return;
                    try {
                        var payload = JSON.parse(event.data);
                        var locationEvent = toDriverLocationEvent(payload);
                        if (!locationEvent) {
                            console.warn("Rejected WS payload: invalid DriverLocationEvent");
                            return;
                        }
                        void updateMarker(locationEvent).then(function () {
                            if (active)
                                setLastUpdateTs(Date.now());
                        });
                    }
                    catch (err) {
                        console.warn("WS payload error:", err);
                    }
                };
            };
            var handleOnlineState = function () {
                var isOnline = navigator.onLine;
                setOnline(isOnline);
                if (isOnline) {
                    connectSocket();
                }
                else {
                    setSyncStatus("disconnected");
                }
            };
            onlineHandler = handleOnlineState;
            window.addEventListener("online", handleOnlineState);
            window.addEventListener("offline", handleOnlineState);
            connectSocket();
        });
        refreshOutboxCount();
        runOutboxSync();
        outboxTimer = window.setInterval(runOutboxSync, OUTBOX_SYNC_MS);
        outboxOnlineHandler = function () {
            if (!navigator.onLine) {
                setOutboxStatus("offline");
            }
            void runOutboxSync();
        };
        window.addEventListener("online", outboxOnlineHandler);
        window.addEventListener("offline", outboxOnlineHandler);
        stalePresenceTimer = window.setInterval(pruneStaleMarkers, 3000);
        return function () {
            active = false;
            if (reconnectTimer)
                window.clearTimeout(reconnectTimer);
            if (socket)
                socket.close();
            for (var _i = 0, _a = markers.values(); _i < _a.length; _i++) {
                var marker = _a[_i];
                marker.remove();
            }
            if (onlineHandler) {
                window.removeEventListener("online", onlineHandler);
                window.removeEventListener("offline", onlineHandler);
            }
            if (outboxTimer)
                window.clearInterval(outboxTimer);
            if (stalePresenceTimer)
                window.clearInterval(stalePresenceTimer);
            if (outboxOnlineHandler) {
                window.removeEventListener("online", outboxOnlineHandler);
                window.removeEventListener("offline", outboxOnlineHandler);
            }
            map.remove();
        };
    }, []);
    return (<div style={{ padding: "16px", display: "grid", gap: "12px" }}>
      <div style={{ fontSize: "18px", fontWeight: 600 }}>
        UMASA TODA Geofence Boundary
      </div>
      <div ref={el} style={{
            width: "100%",
            height: "70vh",
            minHeight: "360px",
            borderRadius: "12px",
            overflow: "hidden",
            border: "1px solid #e0e0e0"
        }}/>
      <TripLogs_1.default limit={30} online={online} status={syncStatus} lastUpdateTs={lastUpdateTs} outboxCount={outboxCount} outboxStatus={outboxStatus}/>
    </div>);
}
