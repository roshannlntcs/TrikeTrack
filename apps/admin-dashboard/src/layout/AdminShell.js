"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminShell;
var react_1 = require("react");
var maplibre_gl_1 = require("maplibre-gl");
var turf = require("@turf/turf");
var reports_1 = require("../lib/reports");
var dashboard_data_1 = require("../lib/dashboard-data");
var emergencies_1 = require("../lib/emergencies");
var geofence_geojson_raw_1 = require("../data/geofence.geojson?raw");
var supabase_1 = require("../lib/supabase");
var ReportsPage_1 = require("../components/ReportsPage");
var ViolatorProfileStack_1 = require("../components/live-map/ViolatorProfileStack");
var ViolationPopup_1 = require("../components/live-map/ViolationPopup");
var violator_types_1 = require("../components/live-map/violator-types");
var smooth_driver_markers_1 = require("../components/live-map/smooth-driver-markers");
var SuperadminPage_1 = require("../superadmin/SuperadminPage");
var TodaManagementPage_1 = require("../toda/TodaManagementPage");
var map_basemaps_1 = require("../lib/map-basemaps");
require("./AdminShell.css");
var renderNavIcon = function (key) {
    var commonProps = {
        width: 18,
        height: 18,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.8,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true
    };
    switch (key) {
        case "home":
            return (<svg {...commonProps}>
          <path d="M3 10.5 12 3l9 7.5"/>
          <path d="M5.5 9.5V20h13V9.5"/>
          <path d="M9.5 20v-6h5v6"/>
        </svg>);
        case "live-map":
            return (<svg {...commonProps}>
          <path d="M9 18 3.8 20.2V6L9 3.8l6 2.4 5.2-2.4v14.2L15 20.2z"/>
          <path d="M9 3.8v14.2"/>
          <path d="M15 6.2v14"/>
        </svg>);
        case "drivers":
            return (<svg {...commonProps}>
          <circle cx="12" cy="8" r="3.2"/>
          <path d="M5.5 19.5c1.7-3 4-4.5 6.5-4.5s4.8 1.5 6.5 4.5"/>
        </svg>);
        case "tricycles":
            return (<svg {...commonProps}>
          <circle cx="7.5" cy="17" r="2"/>
          <circle cx="17.5" cy="17" r="2"/>
          <path d="M5.5 17H4l1.8-6h6.6l2.5 6H14"/>
          <path d="M10 11V8h3.2l2.8 3"/>
        </svg>);
        case "alerts":
            return (<svg {...commonProps}>
          <path d="M12 4a4 4 0 0 0-4 4v2.2c0 .7-.2 1.4-.6 2L6 14.5h12l-1.4-2.3c-.4-.6-.6-1.3-.6-2V8a4 4 0 0 0-4-4Z"/>
          <path d="M10 18a2.2 2.2 0 0 0 4 0"/>
        </svg>);
        case "reports":
            return (<svg {...commonProps}>
          <path d="M7 3.5h7l4 4V20H7z"/>
          <path d="M14 3.5V8h4"/>
          <path d="M10 12h5"/>
          <path d="M10 16h5"/>
        </svg>);
        case "trip-logs":
            return (<svg {...commonProps}>
          <path d="M7 5.5h10"/>
          <path d="M7 12h10"/>
          <path d="M7 18.5h10"/>
          <path d="M4.5 5.5h.01"/>
          <path d="M4.5 12h.01"/>
          <path d="M4.5 18.5h.01"/>
        </svg>);
        case "superadmin":
            return (<svg {...commonProps}>
          <circle cx="12" cy="12" r="3"/>
          <path d="m19 12-.7-.4a7.7 7.7 0 0 0-.2-1.1l.5-.7-1.6-2.7-.8.2a7.8 7.8 0 0 0-.9-.7L14.8 4h-3.6l-.4.8a7.8 7.8 0 0 0-.9.7l-.8-.2-1.6 2.7.5.7a7.7 7.7 0 0 0-.2 1.1L5 12l.7.4c0 .4.1.8.2 1.1l-.5.7 1.6 2.7.8-.2c.3.3.6.5.9.7l.4.8h3.6l.4-.8c.3-.2.6-.4.9-.7l.8.2 1.6-2.7-.5-.7c.1-.3.2-.7.2-1.1Z"/>
        </svg>);
        case "toda-admin":
            return (<svg {...commonProps}>
          <path d="M4 7.5h16"/>
          <path d="M6 4.5h12V19.5H6z"/>
          <path d="M9 11h6"/>
          <path d="M9 14.5h4"/>
        </svg>);
    }
};
var BASE_NAV_ITEMS = [
    { key: "home", label: "Home" },
    { key: "live-map", label: "Live Map" },
    { key: "drivers", label: "Drivers" },
    { key: "alerts", label: "Alerts" },
    { key: "reports", label: "Reports" },
    { key: "trip-logs", label: "Trip Logs" }
];
var TODA_NAV_ITEMS = [
    { key: "home", label: "Home" },
    { key: "live-map", label: "Live Map" },
    { key: "drivers", label: "Drivers" },
    { key: "tricycles", label: "Tricycles" },
    { key: "alerts", label: "Alerts" },
    { key: "reports", label: "Reports" },
    { key: "trip-logs", label: "Trip Logs" }
];
var PAGE_SEARCH_PLACEHOLDERS = {
    home: "Search drivers, alerts, trips...",
    "live-map": "Search driver ID, route, GPS point...",
    drivers: "Search driver ID, name, tricycle, QR...",
    tricycles: "Search tricycle ID, plate, registration...",
    alerts: "Search driver ID, violation, plate, route...",
    reports: "Search report ID, driver, route, plate...",
    "trip-logs": "Search trip ID, driver ID, plate, route...",
    superadmin: "Search admins, barangays, TODAs, routes...",
    "toda-admin": "Search driver ID, tricycle ID, plate..."
};
var RECENT_POINTS_PER_DRIVER = 8;
var OBRERO_CENTER = [125.6128, 7.0848];
var DEFAULT_CITY_ZOOM = 11;
var WORLD_MIN_ZOOM = 1;
var GEOFENCE_FIT_PADDING = 28;
var GEOFENCE_FOCUS_MAX_ZOOM = 13.5;
var HOME_ALERT_SUMMARY_LIMIT = 5;
var HOME_TRIP_LOG_SUMMARY_LIMIT = 6;
var NOTIFICATION_TRIP_WINDOW_MS = 24 * 60 * 60 * 1000;
var NOTIFICATION_DRIVER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
var NOTIFICATION_LIMIT = 12;
var DRIVER_PRESENCE_STALE_MS = 2 * 60 * 1000;
var ALERT_REASON_PRIORITY = {
    EMERGENCY: 100,
    PANIC: 100,
    COLLISION: 95,
    SPEED: 80,
    OUTSIDE_ROUTE_CORRIDOR: 60
};
var FRESH_VIOLATION_WINDOW_MS = 30 * 60 * 1000;
var VIOLATOR_DISMISSALS_STORAGE_KEY_PREFIX = "triketrack-admin-violator-dismissals";
var LIVE_VIOLATORS_STORAGE_KEY_PREFIX = "triketrack-admin-live-violators";
var ACTIVE_VIOLATION_STATUSES = new Set([
    "active",
    "unresolved",
    "pending",
    "open",
    "under_review"
]);
var CLOSED_VIOLATION_STATUSES = new Set(["resolved", "dismissed", "cleared"]);
var OUTSIDE_GEOFENCE_HINTS = [
    "outside_geofence",
    "geofence_exit",
    "geofence",
    "outside geofence",
    "outside route corridor",
    "geofence deviation"
];
var formatLastSeen = function (lastSeenTs, nowTs) {
    var diffSeconds = Math.max(0, Math.floor((nowTs - lastSeenTs) / 1000));
    if (diffSeconds < 60)
        return "".concat(diffSeconds, "s ago");
    var diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60)
        return "".concat(diffMinutes, "m ago");
    var diffHours = Math.floor(diffMinutes / 60);
    return "".concat(diffHours, "h ago");
};
var formatPoint = function (point) {
    return "".concat(point.lat.toFixed(5), ", ").concat(point.lng.toFixed(5));
};
var textMatchesSearch = function (normalizedSearchQuery) {
    var values = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        values[_i - 1] = arguments[_i];
    }
    return values.some(function (value) {
        return value !== undefined &&
            value !== null &&
            String(value).toLowerCase().includes(normalizedSearchQuery);
    });
};
var getAlertPriority = function (alert) {
    var normalizedReason = alert.reason.toUpperCase();
    for (var _i = 0, _a = Object.entries(ALERT_REASON_PRIORITY); _i < _a.length; _i++) {
        var _b = _a[_i], reasonKey = _b[0], score = _b[1];
        if (normalizedReason.includes(reasonKey))
            return score;
    }
    return 40;
};
var formatRelativeTimestamp = function (ts, nowTs) {
    var diffMs = Math.max(0, nowTs - ts);
    var diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1)
        return "Just now";
    if (diffMinutes < 60)
        return "".concat(diffMinutes, "m ago");
    var diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24)
        return "".concat(diffHours, "h ago");
    var diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7)
        return "".concat(diffDays, "d ago");
    return new Date(ts).toLocaleDateString();
};
var isFreshPresence = function (lastSeenTs, nowTs) {
    return nowTs - lastSeenTs <= DRIVER_PRESENCE_STALE_MS;
};
var getGeofenceBounds = function (geofenceFeature) {
    var _a = turf.bbox(geofenceFeature), minLng = _a[0], minLat = _a[1], maxLng = _a[2], maxLat = _a[3];
    return [
        [minLng, minLat],
        [maxLng, maxLat]
    ];
};
var sortNotificationsByRecency = function (a, b) {
    return b.ts - a.ts || b.priority - a.priority;
};
var getNotificationRecencyCutoff = function (recencyFilter, nowTs) {
    if (recencyFilter === "24h")
        return nowTs - 24 * 60 * 60 * 1000;
    if (recencyFilter === "7d")
        return nowTs - 7 * 24 * 60 * 60 * 1000;
    if (recencyFilter === "30d")
        return nowTs - 30 * 24 * 60 * 60 * 1000;
    return null;
};
var getDateFilterStartTs = function (value) {
    if (!value)
        return null;
    return new Date("".concat(value, "T00:00:00")).getTime();
};
var getDateFilterEndTs = function (value) {
    if (!value)
        return null;
    return new Date("".concat(value, "T23:59:59.999")).getTime();
};
var formatDateTime = function (value) { return (value ? new Date(value).toLocaleString() : "-"); };
var formatTripStatus = function (value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
};
var createViolationMarkerElement = function () {
    var markerEl = document.createElement("div");
    markerEl.className = "violation-map-focus-marker";
    markerEl.setAttribute("aria-label", "Outside geofence violation");
    markerEl.innerHTML = "\n    <span class=\"violation-map-focus-marker__pulse\" aria-hidden=\"true\"></span>\n    <span class=\"violation-map-focus-marker__core\" aria-hidden=\"true\">!</span>\n  ";
    return markerEl;
};
var isLngLatPair = function (value) {
    return Array.isArray(value) &&
        value.length >= 2 &&
        typeof value[0] === "number" &&
        Number.isFinite(value[0]) &&
        typeof value[1] === "number" &&
        Number.isFinite(value[1]);
};
var getTripPathCoordinates = function (pathGeojson) {
    if (!pathGeojson || typeof pathGeojson !== "object")
        return [];
    var candidate = pathGeojson;
    var geometry = candidate.type === "Feature" && candidate.geometry && typeof candidate.geometry === "object"
        ? candidate.geometry
        : candidate;
    if ((geometry === null || geometry === void 0 ? void 0 : geometry.type) !== "LineString" || !Array.isArray(geometry.coordinates)) {
        return [];
    }
    return geometry.coordinates.filter(isLngLatPair);
};
function TripPathMap(_a) {
    var tripPath = _a.tripPath;
    var mapRootRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(function () {
        var _a;
        if (!mapRootRef.current)
            return;
        var coordinates = getTripPathCoordinates(tripPath.pathGeojson);
        var map = new maplibre_gl_1.default.Map({
            container: mapRootRef.current,
            style: (0, map_basemaps_1.createRasterStyle)("street"),
            center: (_a = coordinates[0]) !== null && _a !== void 0 ? _a : OBRERO_CENTER,
            zoom: coordinates.length > 0 ? 14 : DEFAULT_CITY_ZOOM,
            minZoom: WORLD_MIN_ZOOM,
            maxZoom: 19
        });
        map.addControl(new maplibre_gl_1.default.NavigationControl({
            showCompass: false,
            visualizePitch: false
        }), "top-right");
        map.on("load", function () {
            if (coordinates.length < 2)
                return;
            var lineFeature = {
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: coordinates
                },
                properties: {}
            };
            map.addSource("trip-path", {
                type: "geojson",
                data: lineFeature
            });
            map.addLayer({
                id: "trip-path-line",
                type: "line",
                source: "trip-path",
                paint: {
                    "line-color": "#2563eb",
                    "line-width": 5,
                    "line-opacity": 0.9
                }
            });
            var bounds = new maplibre_gl_1.default.LngLatBounds();
            for (var _i = 0, coordinates_1 = coordinates; _i < coordinates_1.length; _i++) {
                var coordinate = coordinates_1[_i];
                bounds.extend(coordinate);
            }
            map.fitBounds(bounds, {
                padding: 54,
                maxZoom: 16,
                duration: 0
            });
            var startPoint = coordinates[0];
            var endPoint = coordinates[coordinates.length - 1];
            if (startPoint) {
                new maplibre_gl_1.default.Marker({ color: "#16a34a" })
                    .setLngLat(startPoint)
                    .setPopup(new maplibre_gl_1.default.Popup({ offset: 12 }).setText("Trip start"))
                    .addTo(map);
            }
            if (endPoint) {
                new maplibre_gl_1.default.Marker({ color: "#dc2626" })
                    .setLngLat(endPoint)
                    .setPopup(new maplibre_gl_1.default.Popup({ offset: 12 }).setText("Latest/end point"))
                    .addTo(map);
            }
        });
        return function () {
            map.remove();
        };
    }, [tripPath]);
    return <div className="trip-path-map" ref={mapRootRef}/>;
}
var hasViolationCoordinates = function (alert) {
    return typeof alert.lat === "number" &&
        Number.isFinite(alert.lat) &&
        typeof alert.lng === "number" &&
        Number.isFinite(alert.lng);
};
var formatViolationCoordinates = function (alert) { return (hasViolationCoordinates(alert) ? "".concat(alert.lat.toFixed(6), ", ").concat(alert.lng.toFixed(6)) : undefined); };
var normalizeDriverToken = function (value) {
    if (value === undefined || value === null)
        return null;
    var normalized = String(value).trim().toUpperCase();
    return normalized.length > 0 ? normalized : null;
};
var getViolatorDriverKey = function (_a) {
    var driverCode = _a.driverCode, driverId = _a.driverId;
    var normalizedCode = normalizeDriverToken(driverCode);
    if (normalizedCode)
        return "code:".concat(normalizedCode);
    var normalizedId = normalizeDriverToken(driverId);
    return normalizedId ? "id:".concat(normalizedId) : null;
};
var buildDriverTokens = function () {
    var values = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        values[_i] = arguments[_i];
    }
    return __spreadArray([], new Set(values.map(function (value) { return normalizeDriverToken(value); }).filter(Boolean)), true);
};
var getViolatorTrackingIdentifiers = function (violator) {
    var driverTokens = violator.driverTokens;
    return driverTokens && driverTokens.length > 0 ? driverTokens : [violator.driverId];
};
var hasVisibleDriverTokenMatch = function (violator, visibleIdentifiers) { return violator.driverTokens.some(function (token) { return visibleIdentifiers.has(token); }); };
var isOutsideGeofenceViolation = function (violation) {
    var haystack = [
        violation.violationTypeCode,
        violation.violationTypeLabel,
        violation.description
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return OUTSIDE_GEOFENCE_HINTS.some(function (hint) { return haystack.includes(hint); });
};
var isSameLocalCalendarDay = function (leftTs, rightTs) {
    var left = new Date(leftTs);
    var right = new Date(rightTs);
    return (left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate());
};
var isViolatorActive = function (violator) {
    var normalizedStatus = violator.status.trim().toLowerCase();
    if (CLOSED_VIOLATION_STATUSES.has(normalizedStatus))
        return false;
    if (!ACTIVE_VIOLATION_STATUSES.has(normalizedStatus))
        return false;
    return !violator.resolvedAt;
};
var qualifiesForFreshViolatorStack = function (timestamp, nowTs, hasAnyTodayViolation) {
    var violationTs = new Date(timestamp).getTime();
    if (!Number.isFinite(violationTs))
        return false;
    if (isSameLocalCalendarDay(violationTs, nowTs))
        return true;
    if (hasAnyTodayViolation)
        return false;
    return Math.max(0, nowTs - violationTs) <= FRESH_VIOLATION_WINDOW_MS;
};
var getViolatorDismissalKey = function (violator) {
    return "".concat(violator.source, ":").concat(violator.violationId);
};
var isDriverOnlineNow = function (driver, nowTs, livePresenceHydrated) {
    var _a, _b;
    if (driver.status !== "active")
        return false;
    if (livePresenceHydrated) {
        return Boolean(driver.liveState &&
            driver.liveState.onlineStatus === "online" &&
            isFreshPresence(driver.liveState.lastSeenTs, nowTs));
    }
    return (((_a = driver.liveState) === null || _a === void 0 ? void 0 : _a.onlineStatus) === "online" || ((_b = driver.operationalState) === null || _b === void 0 ? void 0 : _b.isOnline) === true);
};
var getDriverPresenceMeta = function (driver, nowTs, livePresenceHydrated) {
    var _a;
    if (driver.status === "suspended") {
        return { label: "Suspended", className: "status-badge offline" };
    }
    if (driver.status === "inactive") {
        return { label: "Inactive", className: "status-badge offline" };
    }
    if (((_a = driver.operationalState) === null || _a === void 0 ? void 0 : _a.operationalStatus) === "on_trip" &&
        isDriverOnlineNow(driver, nowTs, livePresenceHydrated)) {
        return { label: "On Trip", className: "status-badge online" };
    }
    if (isDriverOnlineNow(driver, nowTs, livePresenceHydrated)) {
        return { label: "Online", className: "status-badge online" };
    }
    return {
        label: "Offline",
        className: "status-badge offline"
    };
};
var driverMatchesSearch = function (driver, normalizedSearchQuery) {
    var _a, _b, _c, _d, _e;
    var latestPoint = (_a = driver.liveState) === null || _a === void 0 ? void 0 : _a.latestPoint;
    var presenceLabel = getDriverPresenceMeta(driver, Date.now(), true).label;
    return textMatchesSearch(normalizedSearchQuery, driver.driverId, driver.driverCode, "".concat(driver.firstName, " ").concat(driver.lastName), driver.firstName, driver.lastName, driver.contactNo, driver.tricycleId, driver.tricycleNo, driver.qrId, driver.todaId, driver.todaName, driver.barangayId, driver.barangayName, driver.status, driver.passwordSet ? "password set" : "password pending", presenceLabel, latestPoint === null || latestPoint === void 0 ? void 0 : latestPoint.tripId, latestPoint ? formatPoint(latestPoint) : undefined, (_b = driver.operationalState) === null || _b === void 0 ? void 0 : _b.activeTripId, (_c = driver.operationalState) === null || _c === void 0 ? void 0 : _c.activeRouteId, (_d = driver.operationalState) === null || _d === void 0 ? void 0 : _d.activeRouteName, (_e = driver.operationalState) === null || _e === void 0 ? void 0 : _e.operationalStatus);
};
var createViolationNotification = function (alert) {
    var _a;
    var driverLabel = (_a = alert.driverName) !== null && _a !== void 0 ? _a : (alert.driverId === "N/A" ? "Unassigned driver" : "Driver ".concat(alert.driverId));
    var details = [
        alert.reason,
        alert.description,
        [alert.barangayName, alert.todaName, alert.status].filter(Boolean).join(" | ")
    ].filter(Boolean);
    return {
        key: "notification-".concat(alert.key),
        kind: "violation",
        page: "alerts",
        title: "".concat(driverLabel, " violation alert"),
        body: details.join(" • "),
        ts: alert.ts,
        priority: getAlertPriority(alert) + (alert.status === "open" ? 30 : 0),
        tone: "danger",
        sourceEntityId: String(alert.key),
        isRead: false
    };
};
var createTripNotification = function (trip) {
    var _a;
    var ts = new Date((_a = trip.tripEnd) !== null && _a !== void 0 ? _a : trip.tripStart).getTime();
    var title = trip.tripStatus === "ongoing"
        ? "Trip in progress for ".concat(trip.driverName)
        : trip.tripStatus === "cancelled"
            ? "Trip cancelled for ".concat(trip.driverName)
            : trip.tripStatus === "completed"
                ? "Trip completed for ".concat(trip.driverName)
                : "Trip scheduled for ".concat(trip.driverName);
    var priority = trip.tripStatus === "ongoing"
        ? 75
        : trip.tripStatus === "cancelled"
            ? 68
            : trip.tripStatus === "completed"
                ? 54
                : 42;
    return {
        key: "notification-trip-".concat(trip.tripId, "-").concat(trip.tripStatus),
        kind: "trip",
        page: "trip-logs",
        title: title,
        body: "".concat(trip.plateNo, " \u2022 ").concat(trip.routeName, " \u2022 ").concat(trip.todaName),
        ts: ts,
        priority: priority,
        tone: trip.tripStatus === "cancelled" ? "warn" : "info",
        sourceEntityId: String(trip.tripId),
        isRead: false
    };
};
var createDriverNotification = function (driver, reason) {
    var ts = new Date(driver.createdAt).getTime();
    var driverLabel = "".concat(driver.firstName, " ").concat(driver.lastName);
    var title = reason === "suspended"
        ? "Driver suspended: ".concat(driverLabel)
        : reason === "inactive"
            ? "Driver inactive: ".concat(driverLabel)
            : reason === "password_pending"
                ? "Driver setup pending: ".concat(driverLabel)
                : "New driver added: ".concat(driverLabel);
    var priority = reason === "suspended"
        ? 72
        : reason === "inactive"
            ? 58
            : reason === "password_pending"
                ? 50
                : 38;
    return {
        key: "notification-driver-".concat(driver.driverId, "-").concat(reason),
        kind: "driver",
        page: "drivers",
        title: title,
        body: "".concat(driver.driverCode, " \u2022 ").concat(driver.todaName, " \u2022 Status ").concat(driver.status),
        ts: ts,
        priority: priority,
        tone: reason === "suspended" ? "danger" : "warn",
        sourceEntityId: String(driver.driverId),
        isRead: false
    };
};
var BellIcon = function () { return (<svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 4.75a4 4 0 0 0-4 4v1.1c0 1.29-.36 2.56-1.03 3.67L5.8 15.44A1 1 0 0 0 6.65 17h10.7a1 1 0 0 0 .85-1.56l-1.17-1.92A7.06 7.06 0 0 1 16 9.85v-1.1a4 4 0 0 0-4-4Zm0 15.5a2.74 2.74 0 0 0 2.58-1.83h-5.16A2.74 2.74 0 0 0 12 20.25Z" fill="currentColor"/>
  </svg>); };
var RefreshIcon = function () { return (<svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 4v6h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>); };
var createPointSignature = function (point) {
    return "".concat(point.ts, "|").concat(point.lng.toFixed(5), "|").concat(point.lat.toFixed(5));
};
var createStoredAlertListItem = function (alert) {
    var _a, _b;
    return ({
        key: "stored-".concat(alert.alertSource, "-").concat(alert.violationId),
        source: "violation",
        driverId: String((_a = alert.driverId) !== null && _a !== void 0 ? _a : "N/A"),
        driverName: (_b = alert.driverName) !== null && _b !== void 0 ? _b : alert.driverCode,
        todaName: alert.todaName,
        barangayName: alert.barangayName,
        plateNo: alert.plateNo,
        routeName: alert.routeName,
        ts: new Date(alert.detectedAt).getTime(),
        reason: alert.violationTypeLabel,
        description: alert.locationLabel
            ? [alert.locationLabel, alert.description].filter(Boolean).join(" | ")
            : alert.description,
        status: alert.status,
        lat: alert.latitude,
        lng: alert.longitude
    });
};
var createStoredEmergencyAlertListItem = function (alert) { return ({
    key: "emergency-".concat(alert.emergencyId),
    source: "emergency",
    emergencyId: alert.emergencyId,
    driverId: String(alert.driverId),
    driverName: alert.driverName,
    todaName: alert.todaName,
    barangayName: alert.barangayName,
    plateNo: alert.plateNo,
    routeName: alert.routeName,
    ts: new Date(alert.updatedAt).getTime(),
    reason: "Passenger Emergency",
    description: [
        "Passenger triggered the emergency action from the QR web form.",
        alert.locationLabel,
        alert.routeName
    ]
        .filter(Boolean)
        .join(" | "),
    status: alert.status,
    lat: alert.latitude,
    lng: alert.longitude
}); };
var getStoredViolationKey = function (alertSource, violationId) { return "".concat(alertSource, ":").concat(violationId); };
void NOTIFICATION_TRIP_WINDOW_MS;
void NOTIFICATION_DRIVER_WINDOW_MS;
void NOTIFICATION_LIMIT;
void createViolationNotification;
void createTripNotification;
void createDriverNotification;
function AdminShell(_a) {
    var _this = this;
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
    var onLogout = _a.onLogout, adminProfile = _a.adminProfile, accessToken = _a.accessToken;
    var mapEl = (0, react_1.useRef)(null);
    var mapRef = (0, react_1.useRef)(null);
    var driverMarkerManagerRef = (0, react_1.useRef)(null);
    var geofenceBoundsRef = (0, react_1.useRef)(null);
    var ensureGeofenceLayersRef = (0, react_1.useRef)(null);
    var appliedMapStyleRef = (0, react_1.useRef)("street");
    var violationFocusMarkerRef = (0, react_1.useRef)(null);
    var _1 = (0, react_1.useState)(adminProfile.role === "superadmin"
        ? "superadmin"
        : "home"), activePage = _1[0], setActivePage = _1[1];
    var selectedMapStyle = (0, react_1.useState)("street")[0];
    var _2 = (0, react_1.useState)("connecting"), syncStatus = _2[0], setSyncStatus = _2[1];
    var _3 = (0, react_1.useState)(null), lastUpdateTs = _3[0], setLastUpdateTs = _3[1];
    var _4 = (0, react_1.useState)(navigator.onLine), online = _4[0], setOnline = _4[1];
    var _5 = (0, react_1.useState)({}), driversById = _5[0], setDriversById = _5[1];
    var driversByIdRef = (0, react_1.useRef)({});
    var _6 = (0, react_1.useState)(null), dashboardData = _6[0], setDashboardData = _6[1];
    var _7 = (0, react_1.useState)(null), dashboardError = _7[0], setDashboardError = _7[1];
    var _8 = (0, react_1.useState)(null), dashboardNotice = _8[0], setDashboardNotice = _8[1];
    var _9 = (0, react_1.useState)(null), lastDashboardSyncAt = _9[0], setLastDashboardSyncAt = _9[1];
    var _10 = (0, react_1.useState)("none"), dashboardDataSource = _10[0], setDashboardDataSource = _10[1];
    var _11 = (0, react_1.useState)(Date.now()), clockTs = _11[0], setClockTs = _11[1];
    var _12 = (0, react_1.useState)(""), searchQuery = _12[0], setSearchQuery = _12[1];
    var _13 = (0, react_1.useState)(null), childSearchPlaceholder = _13[0], setChildSearchPlaceholder = _13[1];
    var _14 = (0, react_1.useState)(false), notificationsOpen = _14[0], setNotificationsOpen = _14[1];
    var _15 = (0, react_1.useState)(false), isRefreshingNotifications = _15[0], setIsRefreshingNotifications = _15[1];
    var _16 = (0, react_1.useState)("all"), notificationCategoryFilter = _16[0], setNotificationCategoryFilter = _16[1];
    var _17 = (0, react_1.useState)("all"), notificationRecencyFilter = _17[0], setNotificationRecencyFilter = _17[1];
    var _18 = (0, react_1.useState)("all"), notificationReadFilter = _18[0], setNotificationReadFilter = _18[1];
    var _19 = (0, react_1.useState)(""), notificationDateFrom = _19[0], setNotificationDateFrom = _19[1];
    var _20 = (0, react_1.useState)(""), notificationDateTo = _20[0], setNotificationDateTo = _20[1];
    var _21 = (0, react_1.useState)(false), profileModalOpen = _21[0], setProfileModalOpen = _21[1];
    var reportsPageSection = (0, react_1.useState)("reports")[0];
    var _22 = (0, react_1.useState)(null), selectedDriverId = _22[0], setSelectedDriverId = _22[1];
    var _23 = (0, react_1.useState)(false), driverTripHistoryOpen = _23[0], setDriverTripHistoryOpen = _23[1];
    var _24 = (0, react_1.useState)(null), selectedTripForPath = _24[0], setSelectedTripForPath = _24[1];
    var _25 = (0, react_1.useState)(null), tripPathData = _25[0], setTripPathData = _25[1];
    var _26 = (0, react_1.useState)(false), tripPathLoading = _26[0], setTripPathLoading = _26[1];
    var _27 = (0, react_1.useState)(null), tripPathError = _27[0], setTripPathError = _27[1];
    var _28 = (0, react_1.useState)(false), livePresenceHydrated = _28[0], setLivePresenceHydrated = _28[1];
    var _29 = (0, react_1.useState)(null), activeEmergencyModal = _29[0], setActiveEmergencyModal = _29[1];
    var _30 = (0, react_1.useState)([]), emergencyQueue = _30[0], setEmergencyQueue = _30[1];
    var _31 = (0, react_1.useState)(null), emergencyActionBusyId = _31[0], setEmergencyActionBusyId = _31[1];
    var _32 = (0, react_1.useState)(null), activeViolationAlert = _32[0], setActiveViolationAlert = _32[1];
    var _33 = (0, react_1.useState)([]), violationAlertQueue = _33[0], setViolationAlertQueue = _33[1];
    var _34 = (0, react_1.useState)({}), liveViolatorsByKey = _34[0], setLiveViolatorsByKey = _34[1];
    var _35 = (0, react_1.useState)({}), storedViolatorsByKey = _35[0], setStoredViolatorsByKey = _35[1];
    var _36 = (0, react_1.useState)(null), selectedViolatorKey = _36[0], setSelectedViolatorKey = _36[1];
    var _37 = (0, react_1.useState)(null), selectedViolationPopupPosition = _37[0], setSelectedViolationPopupPosition = _37[1];
    var _38 = (0, react_1.useState)({}), dismissedViolatorsByDriver = _38[0], setDismissedViolatorsByDriver = _38[1];
    var dashboardDataRef = (0, react_1.useRef)(null);
    var lastDashboardSyncAtRef = (0, react_1.useRef)(null);
    var dashboardRefreshInFlightRef = (0, react_1.useRef)(null);
    var dashboardRefreshQueuedRef = (0, react_1.useRef)(false);
    var visibleDriverIdentifiersRef = (0, react_1.useRef)(new Set());
    var dashboardDriversRef = (0, react_1.useRef)([]);
    var knownViolationKeysRef = (0, react_1.useRef)(new Set());
    var pendingViolationPopupKeysRef = (0, react_1.useRef)(new Set());
    var shownViolationPopupKeysRef = (0, react_1.useRef)(new Set());
    var violationsHydratedRef = (0, react_1.useRef)(false);
    var driverInsideStateRef = (0, react_1.useRef)({});
    var refreshLiveLocationsRef = (0, react_1.useRef)(null);
    var notificationPanelRef = (0, react_1.useRef)(null);
    var trimmedSearchQuery = searchQuery.trim();
    var normalizedSearchQuery = trimmedSearchQuery.toLowerCase();
    var hasSearchQuery = normalizedSearchQuery.length > 0;
    var showLiveMapView = activePage === "home" || activePage === "live-map";
    var showViolatorOverlay = activePage === "live-map";
    var violatorDismissalsStorageKey = "".concat(VIOLATOR_DISMISSALS_STORAGE_KEY_PREFIX, ":").concat(adminProfile.adminId);
    var liveViolatorsStorageKey = "".concat(LIVE_VIOLATORS_STORAGE_KEY_PREFIX, ":").concat(adminProfile.adminId);
    var activeViolators = (0, react_1.useMemo)(function () {
        var _a, _b, _c;
        var newestByDriver = new Map();
        var visibleIdentifiers = visibleDriverIdentifiersRef.current;
        var candidates = __spreadArray(__spreadArray([], Object.values(liveViolatorsByKey), true), Object.values(storedViolatorsByKey), true).filter(function (violator) {
            return isViolatorActive(violator) &&
                !violator.uiDismissedByAdmin &&
                hasVisibleDriverTokenMatch(violator, visibleIdentifiers);
        });
        for (var _i = 0, candidates_1 = candidates; _i < candidates_1.length; _i++) {
            var violator = candidates_1[_i];
            var existing = newestByDriver.get(violator.driverKey);
            if (!existing) {
                newestByDriver.set(violator.driverKey, violator);
                continue;
            }
            var existingTs = (0, violator_types_1.getViolatorTimestampMs)(existing);
            var incomingTs = (0, violator_types_1.getViolatorTimestampMs)(violator);
            var latest = incomingTs >= existingTs ? violator : existing;
            var fallback = latest === violator ? existing : violator;
            newestByDriver.set(violator.driverKey, __assign(__assign(__assign({}, fallback), latest), { avatarUrl: (_b = (_a = latest.avatarUrl) !== null && _a !== void 0 ? _a : fallback.avatarUrl) !== null && _b !== void 0 ? _b : null, locationLabel: (_c = latest.locationLabel) !== null && _c !== void 0 ? _c : fallback.locationLabel, driverTokens: __spreadArray([], new Set(__spreadArray(__spreadArray([], existing.driverTokens, true), violator.driverTokens, true)), true) }));
        }
        return __spreadArray([], newestByDriver.values(), true).filter(function (violator) {
            var dismissed = dismissedViolatorsByDriver[violator.driverKey];
            return !dismissed || dismissed.dismissalKey !== getViolatorDismissalKey(violator);
        })
            .sort(violator_types_1.sortViolatorsByRecency);
    }, [dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.drivers, dismissedViolatorsByDriver, liveViolatorsByKey, storedViolatorsByKey]);
    var selectedViolator = (0, react_1.useMemo)(function () { var _a; return (_a = activeViolators.find(function (violator) { return violator.driverKey === selectedViolatorKey; })) !== null && _a !== void 0 ? _a : null; }, [activeViolators, selectedViolatorKey]);
    var upsertStoredViolator = function (violator) {
        setStoredViolatorsByKey(function (current) {
            var _a;
            return (__assign(__assign({}, current), (_a = {}, _a[violator.driverKey] = violator, _a)));
        });
    };
    var upsertLiveViolator = function (violator) {
        setLiveViolatorsByKey(function (current) {
            var _a;
            var existing = current[violator.driverKey];
            if (existing &&
                existing.violationId === violator.violationId &&
                existing.latitude === violator.latitude &&
                existing.longitude === violator.longitude &&
                existing.timestamp === violator.timestamp) {
                return current;
            }
            return __assign(__assign({}, current), (_a = {}, _a[violator.driverKey] = violator, _a));
        });
    };
    var updateViolatorsByTokens = function (tokens, updater) {
        if (tokens.length === 0)
            return;
        var tokenSet = new Set(tokens.map(function (token) { return token.trim().toUpperCase(); }));
        var applyUpdate = function (current) {
            var changed = false;
            var next = {};
            for (var _i = 0, _a = Object.entries(current); _i < _a.length; _i++) {
                var _b = _a[_i], driverKey = _b[0], violator = _b[1];
                var matches = violator.driverTokens.some(function (token) { return tokenSet.has(token); });
                if (!matches) {
                    next[driverKey] = violator;
                    continue;
                }
                var updated = updater(violator);
                if (!updated) {
                    changed = true;
                    continue;
                }
                changed = changed || updated !== violator;
                next[driverKey] = updated;
            }
            return changed ? next : current;
        };
        setLiveViolatorsByKey(applyUpdate);
        setStoredViolatorsByKey(applyUpdate);
    };
    var dismissViolatorProfile = function (violator) {
        var dismissalKey = getViolatorDismissalKey(violator);
        setDismissedViolatorsByDriver(function (current) {
            var _a;
            return (__assign(__assign({}, current), (_a = {}, _a[violator.driverKey] = {
                dismissalKey: dismissalKey,
                dismissedAt: Date.now()
            }, _a)));
        });
        var removeByDriverKey = function (current) {
            var next = __assign({}, current);
            for (var _i = 0, _a = Object.entries(current); _i < _a.length; _i++) {
                var _b = _a[_i], driverKey = _b[0], item = _b[1];
                if (driverKey === violator.driverKey || item.driverKey === violator.driverKey) {
                    delete next[driverKey];
                }
            }
            return next;
        };
        setLiveViolatorsByKey(removeByDriverKey);
        setStoredViolatorsByKey(removeByDriverKey);
        if (selectedViolatorKey === violator.driverKey) {
            setSelectedViolatorKey(null);
            setSelectedViolationPopupPosition(null);
        }
    };
    var purgeViolatorProfilesByTokens = function (tokens) {
        var _a, _b;
        if (tokens.length === 0)
            return;
        var tokenSet = new Set(tokens.map(function (token) { return token.trim().toUpperCase(); }));
        var selectedMatches = (_b = (_a = selectedViolator === null || selectedViolator === void 0 ? void 0 : selectedViolator.driverTokens) === null || _a === void 0 ? void 0 : _a.some(function (token) { return tokenSet.has(token); })) !== null && _b !== void 0 ? _b : false;
        updateViolatorsByTokens(tokens, function () { return null; });
        setDismissedViolatorsByDriver(function (current) {
            var next = __assign({}, current);
            for (var _i = 0, _a = Object.keys(current); _i < _a.length; _i++) {
                var driverKey = _a[_i];
                var normalizedDriverKey = driverKey.trim().toUpperCase();
                if (tokenSet.has(normalizedDriverKey.replace(/^CODE:/, "")) || tokenSet.has(normalizedDriverKey.replace(/^ID:/, ""))) {
                    delete next[driverKey];
                }
            }
            return next;
        });
        if (selectedMatches) {
            setSelectedViolatorKey(null);
            setSelectedViolationPopupPosition(null);
        }
    };
    var getDashboardDriverByIdentifier = function (driverIdentifier) {
        var _a;
        var normalizedIdentifier = String(driverIdentifier).trim().toUpperCase();
        return (_a = dashboardDataRef.current) === null || _a === void 0 ? void 0 : _a.drivers.find(function (driver) {
            return (String(driver.driverId) === String(driverIdentifier) ||
                driver.driverCode.trim().toUpperCase() === normalizedIdentifier);
        });
    };
    var getDashboardTripForViolation = function (driverId, tripId) {
        var _a, _b;
        var trips = (_b = (_a = dashboardDataRef.current) === null || _a === void 0 ? void 0 : _a.recentTrips) !== null && _b !== void 0 ? _b : [];
        if (tripId !== undefined) {
            var normalizedTripId_1 = String(tripId).replace(/^TRIP-/i, "");
            var byTripId = trips.find(function (trip) { return String(trip.tripId) === normalizedTripId_1; });
            if (byTripId)
                return byTripId;
        }
        if (driverId === undefined)
            return undefined;
        return trips.find(function (trip) { return trip.driverId === driverId && trip.tripStatus === "ongoing"; });
    };
    var queueViolationAlert = function (alert) {
        setActiveViolationAlert(function (current) {
            if (!current)
                return alert;
            if (current.key === alert.key)
                return current;
            setViolationAlertQueue(function (queue) {
                return queue.some(function (item) { return item.key === alert.key; }) ? queue : __spreadArray(__spreadArray([], queue, true), [alert], false);
            });
            return current;
        });
    };
    var closeViolationAlert = function () {
        setActiveViolationAlert(null);
        setViolationAlertQueue(function (queue) {
            var next = queue[0], rest = queue.slice(1);
            if (next) {
                window.setTimeout(function () { return setActiveViolationAlert(next); }, 0);
            }
            return rest;
        });
    };
    var focusViolationOnMap = function (alert) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!hasViolationCoordinates(alert))
            return;
        closeViolationAlert();
        var driverLookupToken = (_a = alert.driverCode) !== null && _a !== void 0 ? _a : alert.driverId;
        var driverRecord = driverLookupToken
            ? getDashboardDriverByIdentifier(driverLookupToken)
            : undefined;
        var liveState = driverRecord
            ? (_b = driversByIdRef.current[driverRecord.driverCode]) !== null && _b !== void 0 ? _b : driversByIdRef.current[String(driverRecord.driverId)]
            : undefined;
        var driverKey = (_c = getViolatorDriverKey({
            driverCode: alert.driverCode,
            driverId: alert.driverId
        })) !== null && _c !== void 0 ? _c : "alert:".concat(alert.key);
        var nextViolator = {
            driverKey: driverKey,
            driverId: (_d = normalizeDriverToken(alert.driverCode)) !== null && _d !== void 0 ? _d : (alert.driverId !== undefined ? String(alert.driverId) : "Unknown driver"),
            driverName: (_f = (_e = alert.driverName) !== null && _e !== void 0 ? _e : alert.driverCode) !== null && _f !== void 0 ? _f : "Unknown driver",
            avatarUrl: (_g = alert.profileImageUrl) !== null && _g !== void 0 ? _g : null,
            latitude: alert.lat,
            longitude: alert.lng,
            violationType: "Outside geofence",
            timestamp: alert.timestamp,
            status: "active",
            violationId: alert.key,
            source: alert.source,
            locationLabel: alert.locationLabel,
            tripId: alert.tripId,
            routeName: alert.routeName,
            resolvedAt: null,
            driverOnlineStatus: liveState ? "online" : "offline",
            lastSeenTs: (_h = liveState === null || liveState === void 0 ? void 0 : liveState.lastSeenTs) !== null && _h !== void 0 ? _h : null,
            uiDismissedByAdmin: false,
            driverTokens: buildDriverTokens(alert.driverCode, alert.driverId)
        };
        if (alert.source === "live_geofence") {
            upsertLiveViolator(nextViolator);
        }
        else {
            upsertStoredViolator(nextViolator);
        }
        setSelectedViolatorKey(driverKey);
        setActivePage("live-map");
        window.setTimeout(function () {
            var map = mapRef.current;
            if (!map)
                return;
            map.resize();
            map.flyTo({
                center: [nextViolator.longitude, nextViolator.latitude],
                zoom: Math.max(map.getZoom(), 16.2),
                essential: true
            });
        }, 80);
    };
    var refreshDashboardData = function () { return __awaiter(_this, void 0, void 0, function () {
        var runRefresh, pendingRefresh;
        var _this = this;
        return __generator(this, function (_a) {
            if (dashboardRefreshInFlightRef.current) {
                dashboardRefreshQueuedRef.current = true;
                return [2 /*return*/, dashboardRefreshInFlightRef.current];
            }
            runRefresh = function () { return __awaiter(_this, void 0, void 0, function () {
                var snapshot, syncedAt, error_1, fallbackTimestamp;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _c.trys.push([0, 2, 3, 4]);
                            return [4 /*yield*/, (0, dashboard_data_1.fetchDashboardData)(accessToken)];
                        case 1:
                            snapshot = _c.sent();
                            setDashboardData(snapshot);
                            syncedAt = (_b = (_a = snapshot.cacheMeta) === null || _a === void 0 ? void 0 : _a.savedAt) !== null && _b !== void 0 ? _b : new Date().toISOString();
                            setLastDashboardSyncAt(syncedAt);
                            lastDashboardSyncAtRef.current = syncedAt;
                            setDashboardDataSource(snapshot.cacheMeta ? "cache" : "live");
                            setDashboardNotice(snapshot.cacheMeta
                                ? "Showing cached dashboard data from ".concat(formatDateTime(snapshot.cacheMeta.savedAt), ".")
                                : null);
                            setDashboardError(null);
                            return [3 /*break*/, 4];
                        case 2:
                            error_1 = _c.sent();
                            if (dashboardDataRef.current) {
                                fallbackTimestamp = lastDashboardSyncAtRef.current;
                                setDashboardDataSource("cache");
                                setDashboardNotice(fallbackTimestamp
                                    ? "Unable to refresh live dashboard data. Showing last synced data from ".concat(formatDateTime(fallbackTimestamp), ".")
                                    : "Unable to refresh live dashboard data. Showing the last synced snapshot.");
                                setDashboardError(null);
                            }
                            else {
                                setDashboardError(String(error_1));
                            }
                            return [3 /*break*/, 4];
                        case 3:
                            dashboardRefreshInFlightRef.current = null;
                            if (dashboardRefreshQueuedRef.current) {
                                dashboardRefreshQueuedRef.current = false;
                                void refreshDashboardData();
                            }
                            return [7 /*endfinally*/];
                        case 4: return [2 /*return*/];
                    }
                });
            }); };
            pendingRefresh = runRefresh();
            dashboardRefreshInFlightRef.current = pendingRefresh;
            return [2 /*return*/, pendingRefresh];
        });
    }); };
    var refreshNotificationsAndAlerts = function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setIsRefreshingNotifications(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, , 3, 4]);
                    return [4 /*yield*/, refreshDashboardData()];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    setIsRefreshingNotifications(false);
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    (0, react_1.useEffect)(function () {
        var timer = window.setInterval(function () { return setClockTs(Date.now()); }, 3000);
        return function () { return window.clearInterval(timer); };
    }, []);
    (0, react_1.useEffect)(function () {
        setChildSearchPlaceholder(null);
    }, [activePage]);
    (0, react_1.useEffect)(function () {
        var active = true;
        void (function () { return __awaiter(_this, void 0, void 0, function () {
            var cachedSnapshot, snapshot, syncedAt, error_2, fallbackTimestamp;
            var _a, _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _g.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, (0, dashboard_data_1.getCachedDashboardData)()];
                    case 1:
                        cachedSnapshot = _g.sent();
                        if (active && cachedSnapshot) {
                            setDashboardData(cachedSnapshot);
                            setDashboardNotice(cachedSnapshot.cacheMeta
                                ? "Offline-ready snapshot loaded from ".concat(formatDateTime(cachedSnapshot.cacheMeta.savedAt), ".")
                                : null);
                            setLastDashboardSyncAt((_b = (_a = cachedSnapshot.cacheMeta) === null || _a === void 0 ? void 0 : _a.savedAt) !== null && _b !== void 0 ? _b : null);
                            lastDashboardSyncAtRef.current = (_d = (_c = cachedSnapshot.cacheMeta) === null || _c === void 0 ? void 0 : _c.savedAt) !== null && _d !== void 0 ? _d : null;
                            setDashboardDataSource("cache");
                        }
                        return [4 /*yield*/, (0, dashboard_data_1.fetchDashboardData)(accessToken)];
                    case 2:
                        snapshot = _g.sent();
                        if (!active)
                            return [2 /*return*/];
                        setDashboardData(snapshot);
                        syncedAt = (_f = (_e = snapshot.cacheMeta) === null || _e === void 0 ? void 0 : _e.savedAt) !== null && _f !== void 0 ? _f : new Date().toISOString();
                        setLastDashboardSyncAt(syncedAt);
                        lastDashboardSyncAtRef.current = syncedAt;
                        setDashboardDataSource(snapshot.cacheMeta ? "cache" : "live");
                        setDashboardNotice(snapshot.cacheMeta
                            ? "Showing cached dashboard data from ".concat(formatDateTime(snapshot.cacheMeta.savedAt), ".")
                            : null);
                        setDashboardError(null);
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _g.sent();
                        if (!active)
                            return [2 /*return*/];
                        if (dashboardDataRef.current) {
                            fallbackTimestamp = lastDashboardSyncAtRef.current;
                            setDashboardDataSource("cache");
                            setDashboardNotice(fallbackTimestamp
                                ? "Unable to refresh live dashboard data. Showing last synced data from ".concat(formatDateTime(fallbackTimestamp), ".")
                                : "Unable to refresh live dashboard data. Showing the last synced snapshot.");
                            setDashboardError(null);
                        }
                        else {
                            setDashboardError(String(error_2));
                        }
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); })();
        return function () {
            active = false;
            dashboardRefreshInFlightRef.current = null;
            dashboardRefreshQueuedRef.current = false;
        };
    }, [accessToken]);
    (0, react_1.useEffect)(function () {
        var refreshOnResume = function () {
            var _a;
            if (document.visibilityState === "hidden" || !navigator.onLine)
                return;
            void refreshDashboardData();
            (_a = refreshLiveLocationsRef.current) === null || _a === void 0 ? void 0 : _a.call(refreshLiveLocationsRef);
        };
        var handleVisibilityChange = function () {
            if (document.visibilityState === "visible") {
                refreshOnResume();
            }
        };
        window.addEventListener("focus", refreshOnResume);
        window.addEventListener("pageshow", refreshOnResume);
        window.addEventListener("online", refreshOnResume);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return function () {
            window.removeEventListener("focus", refreshOnResume);
            window.removeEventListener("pageshow", refreshOnResume);
            window.removeEventListener("online", refreshOnResume);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [accessToken]);
    (0, react_1.useEffect)(function () {
        driversByIdRef.current = driversById;
    }, [driversById]);
    (0, react_1.useEffect)(function () {
        dashboardDataRef.current = dashboardData;
    }, [dashboardData]);
    (0, react_1.useEffect)(function () {
        try {
            var raw = window.localStorage.getItem(liveViolatorsStorageKey);
            if (!raw)
                return;
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object")
                return;
            var normalizedEntries = Object.entries(parsed).filter(function (entry) {
                var violator = entry[1];
                return (violator &&
                    typeof violator === "object" &&
                    typeof violator.driverKey === "string" &&
                    typeof violator.violationId === "string" &&
                    typeof violator.timestamp === "string" &&
                    typeof violator.latitude === "number" &&
                    typeof violator.longitude === "number");
            });
            if (normalizedEntries.length === 0)
                return;
            setLiveViolatorsByKey(Object.fromEntries(normalizedEntries));
        }
        catch (_a) {
            // Ignore invalid cached live violator data.
        }
    }, [liveViolatorsStorageKey]);
    (0, react_1.useEffect)(function () {
        window.localStorage.setItem(liveViolatorsStorageKey, JSON.stringify(liveViolatorsByKey));
    }, [liveViolatorsByKey, liveViolatorsStorageKey]);
    (0, react_1.useEffect)(function () {
        try {
            var raw = window.localStorage.getItem(violatorDismissalsStorageKey);
            if (!raw) {
                setDismissedViolatorsByDriver({});
                return;
            }
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") {
                setDismissedViolatorsByDriver({});
                return;
            }
            var normalized = {};
            for (var _i = 0, _a = Object.entries(parsed); _i < _a.length; _i++) {
                var _b = _a[_i], driverKey = _b[0], value = _b[1];
                if (typeof value === "string") {
                    normalized[driverKey] = {
                        dismissalKey: value,
                        dismissedAt: Date.now()
                    };
                    continue;
                }
                if (value &&
                    typeof value === "object" &&
                    typeof value.dismissalKey === "string" &&
                    typeof value.dismissedAt === "number") {
                    normalized[driverKey] = value;
                }
            }
            setDismissedViolatorsByDriver(normalized);
        }
        catch (_c) {
            setDismissedViolatorsByDriver({});
        }
    }, [violatorDismissalsStorageKey]);
    (0, react_1.useEffect)(function () {
        window.localStorage.setItem(violatorDismissalsStorageKey, JSON.stringify(dismissedViolatorsByDriver));
    }, [dismissedViolatorsByDriver, violatorDismissalsStorageKey]);
    (0, react_1.useEffect)(function () {
        var _a, _b, _c;
        if (!dashboardData)
            return;
        dashboardDriversRef.current = (_a = dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.drivers) !== null && _a !== void 0 ? _a : [];
        var identifiers = new Set();
        for (var _i = 0, _d = (_b = dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.drivers) !== null && _b !== void 0 ? _b : []; _i < _d.length; _i++) {
            var driver = _d[_i];
            identifiers.add(String(driver.driverId));
            identifiers.add(driver.driverCode.trim().toUpperCase());
        }
        visibleDriverIdentifiersRef.current = identifiers;
        setLiveViolatorsByKey(function (current) {
            var nextEntries = Object.entries(current).filter(function (_a) {
                var violator = _a[1];
                return hasVisibleDriverTokenMatch(violator, identifiers);
            });
            return nextEntries.length === Object.keys(current).length
                ? current
                : Object.fromEntries(nextEntries);
        });
        setStoredViolatorsByKey(function (current) {
            var nextEntries = Object.entries(current).filter(function (_a) {
                var violator = _a[1];
                return hasVisibleDriverTokenMatch(violator, identifiers);
            });
            return nextEntries.length === Object.keys(current).length
                ? current
                : Object.fromEntries(nextEntries);
        });
        (_c = refreshLiveLocationsRef.current) === null || _c === void 0 ? void 0 : _c.call(refreshLiveLocationsRef);
    }, [dashboardData]);
    (0, react_1.useEffect)(function () {
        if (!notificationsOpen)
            return;
        var handlePointerDown = function (event) {
            var _a;
            if (!((_a = notificationPanelRef.current) === null || _a === void 0 ? void 0 : _a.contains(event.target))) {
                setNotificationsOpen(false);
            }
        };
        var handleKeyDown = function (event) {
            if (event.key === "Escape")
                setNotificationsOpen(false);
        };
        window.addEventListener("mousedown", handlePointerDown);
        window.addEventListener("keydown", handleKeyDown);
        return function () {
            window.removeEventListener("mousedown", handlePointerDown);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [notificationsOpen]);
    (0, react_1.useEffect)(function () {
        if (selectedDriverId === null)
            return;
        var previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        var handleKeyDown = function (event) {
            if (event.key === "Escape") {
                if (driverTripHistoryOpen) {
                    setDriverTripHistoryOpen(false);
                    return;
                }
                setSelectedDriverId(null);
                setDriverTripHistoryOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return function () {
            document.body.style.overflow = previousBodyOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [driverTripHistoryOpen, selectedDriverId]);
    (0, react_1.useEffect)(function () {
        if (!profileModalOpen)
            return;
        var handleKeyDown = function (event) {
            if (event.key === "Escape") {
                setProfileModalOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return function () { return window.removeEventListener("keydown", handleKeyDown); };
    }, [profileModalOpen]);
    (0, react_1.useEffect)(function () {
        if (!selectedTripForPath) {
            setTripPathData(null);
            setTripPathError(null);
            setTripPathLoading(false);
            return;
        }
        var active = true;
        setTripPathLoading(true);
        setTripPathError(null);
        setTripPathData(null);
        void (function () { return __awaiter(_this, void 0, void 0, function () {
            var cachedPath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, dashboard_data_1.getCachedTripPath)(selectedTripForPath.tripId)];
                    case 1:
                        cachedPath = _a.sent();
                        if (!active || !cachedPath)
                            return [2 /*return*/];
                        setTripPathData(cachedPath);
                        setTripPathError(cachedPath.cacheMeta
                            ? "Offline-ready trip path loaded from ".concat(formatDateTime(cachedPath.cacheMeta.savedAt), ".")
                            : null);
                        setTripPathLoading(false);
                        return [2 /*return*/];
                }
            });
        }); })();
        void (0, dashboard_data_1.fetchTripPath)(accessToken, selectedTripForPath.tripId)
            .then(function (path) {
            if (!active)
                return;
            setTripPathData(path);
            setTripPathError((path === null || path === void 0 ? void 0 : path.cacheMeta)
                ? "Showing cached trip path from ".concat(formatDateTime(path.cacheMeta.savedAt), ".")
                : null);
        })
            .catch(function (error) {
            if (active)
                setTripPathError(String(error));
        })
            .finally(function () {
            if (active)
                setTripPathLoading(false);
        });
        return function () {
            active = false;
        };
    }, [accessToken, selectedTripForPath]);
    (0, react_1.useEffect)(function () {
        var _a, _b, _c, _d, _e;
        if (!mapEl.current)
            return;
        setLivePresenceHydrated(false);
        var geofence = JSON.parse(geofence_geojson_raw_1.default);
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
        var geofencePolyline = (_e = (_d = geofence.features) === null || _d === void 0 ? void 0 : _d.find(function (feature) { var _a; return ((_a = feature.geometry) === null || _a === void 0 ? void 0 : _a.type) === "LineString"; })) !== null && _e !== void 0 ? _e : turf.polygonToLine(geofencePolygon);
        var geofenceBounds = getGeofenceBounds(geofencePolygon);
        var map = new maplibre_gl_1.default.Map({
            container: mapEl.current,
            style: (0, map_basemaps_1.createRasterStyle)(selectedMapStyle),
            center: OBRERO_CENTER,
            zoom: DEFAULT_CITY_ZOOM,
            minZoom: WORLD_MIN_ZOOM,
            maxZoom: 19,
            renderWorldCopies: true
        });
        mapRef.current = map;
        appliedMapStyleRef.current = selectedMapStyle;
        map.addControl(new maplibre_gl_1.default.NavigationControl({
            showCompass: false,
            visualizePitch: false
        }), "top-right");
        map.on("error", function (error) {
            console.error("MapLibre error:", (error === null || error === void 0 ? void 0 : error.error) || error);
        });
        var liveLocationChannel = null;
        var dashboardEventChannel = null;
        var active = true;
        var onlineHandler = null;
        var dashboardRefreshTimer;
        var stalePresenceTimer;
        var pendingGeofenceFit = false;
        var geofenceRetryQueued = false;
        var ensureGeofenceLayers = function (fitToBounds) {
            if (fitToBounds === void 0) { fitToBounds = false; }
            geofenceBoundsRef.current = geofenceBounds;
            if (fitToBounds) {
                pendingGeofenceFit = true;
            }
            if (!map.isStyleLoaded()) {
                if (!geofenceRetryQueued) {
                    geofenceRetryQueued = true;
                    map.once("style.load", function () {
                        geofenceRetryQueued = false;
                        ensureGeofenceLayers(false);
                    });
                }
                return;
            }
            var shouldFitToBounds = pendingGeofenceFit;
            pendingGeofenceFit = false;
            if (shouldFitToBounds) {
                map.fitBounds(geofenceBounds, {
                    padding: GEOFENCE_FIT_PADDING,
                    duration: 0,
                    maxZoom: GEOFENCE_FOCUS_MAX_ZOOM
                });
            }
            if (!map.getSource("area-geofence")) {
                map.addSource("area-geofence", {
                    type: "geojson",
                    data: geofencePolygon
                });
            }
            if (!map.getLayer("area-geofence-fill")) {
                map.addLayer({
                    id: "area-geofence-fill",
                    type: "fill",
                    source: "area-geofence",
                    paint: {
                        "fill-color": "#0ea5e9",
                        "fill-opacity": 0.12
                    }
                });
            }
            if (!map.getLayer("area-geofence-outline")) {
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
            }
            if (!map.getSource("geofence-boundary")) {
                map.addSource("geofence-boundary", {
                    type: "geojson",
                    data: geofencePolyline
                });
            }
            if (!map.getLayer("geofence-boundary-line")) {
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
            }
        };
        ensureGeofenceLayersRef.current = ensureGeofenceLayers;
        var scheduleDashboardRefresh = function () {
            if (dashboardRefreshTimer) {
                window.clearTimeout(dashboardRefreshTimer);
            }
            dashboardRefreshTimer = window.setTimeout(function () {
                dashboardRefreshTimer = undefined;
                void refreshDashboardData();
            }, 250);
        };
        var getDriverRecord = function (driverIdentifier) {
            var normalizedIdentifier = driverIdentifier.trim().toUpperCase();
            return dashboardDriversRef.current.find(function (driver) {
                var normalizedCode = driver.driverCode.trim().toUpperCase();
                return (normalizedCode === normalizedIdentifier ||
                    String(driver.driverId) === driverIdentifier);
            });
        };
        var getDriverLabel = function (driverIdentifier) {
            var driver = getDriverRecord(driverIdentifier);
            if (!driver)
                return driverIdentifier;
            return "".concat(driver.firstName, " ").concat(driver.lastName);
        };
        var getDriverInitials = function (driverIdentifier) {
            var driver = getDriverRecord(driverIdentifier);
            if (driver) {
                return "".concat(driver.firstName.charAt(0)).concat(driver.lastName.charAt(0))
                    .toUpperCase()
                    .slice(0, 2);
            }
            return driverIdentifier.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase() || "D";
        };
        var getDriverAvatarUrl = function (driverIdentifier) {
            var _a, _b;
            var avatarUrl = (_b = (_a = getDriverRecord(driverIdentifier)) === null || _a === void 0 ? void 0 : _a.avatarUrl) === null || _b === void 0 ? void 0 : _b.trim();
            return avatarUrl ? avatarUrl : null;
        };
        var createDriverPopupContent = function (driverIdentifier) {
            var wrapper = document.createElement("div");
            wrapper.style.display = "grid";
            wrapper.style.gridTemplateColumns = "40px 1fr";
            wrapper.style.gap = "10px";
            wrapper.style.alignItems = "center";
            wrapper.style.minWidth = "190px";
            var avatarFrame = document.createElement("div");
            avatarFrame.style.width = "40px";
            avatarFrame.style.height = "40px";
            avatarFrame.style.borderRadius = "999px";
            avatarFrame.style.overflow = "hidden";
            avatarFrame.style.display = "grid";
            avatarFrame.style.placeItems = "center";
            avatarFrame.style.background = "#0f172a";
            avatarFrame.style.color = "#f8fafc";
            avatarFrame.style.fontSize = "13px";
            avatarFrame.style.fontWeight = "700";
            var avatarUrl = getDriverAvatarUrl(driverIdentifier);
            if (avatarUrl) {
                var imageEl = document.createElement("img");
                imageEl.src = avatarUrl;
                imageEl.alt = getDriverLabel(driverIdentifier);
                imageEl.style.width = "100%";
                imageEl.style.height = "100%";
                imageEl.style.objectFit = "cover";
                imageEl.onerror = function () {
                    avatarFrame.replaceChildren();
                    avatarFrame.textContent = getDriverInitials(driverIdentifier);
                };
                avatarFrame.appendChild(imageEl);
            }
            else {
                avatarFrame.textContent = getDriverInitials(driverIdentifier);
            }
            var content = document.createElement("div");
            content.style.display = "grid";
            content.style.gap = "3px";
            var nameEl = document.createElement("strong");
            nameEl.textContent = getDriverLabel(driverIdentifier);
            var codeEl = document.createElement("div");
            codeEl.textContent = driverIdentifier;
            codeEl.style.fontSize = "12px";
            codeEl.style.color = "#475569";
            content.appendChild(nameEl);
            content.appendChild(codeEl);
            wrapper.appendChild(avatarFrame);
            wrapper.appendChild(content);
            return wrapper;
        };
        var renderMarkerFrameContent = function (markerEl, driverIdentifier) {
            var frameEl = markerEl.querySelector("[data-marker-frame]");
            if (!frameEl)
                return;
            frameEl.replaceChildren();
            var avatarUrl = getDriverAvatarUrl(driverIdentifier);
            if (avatarUrl) {
                var imageEl = document.createElement("img");
                imageEl.src = avatarUrl;
                imageEl.alt = getDriverLabel(driverIdentifier);
                imageEl.style.width = "100%";
                imageEl.style.height = "100%";
                imageEl.style.objectFit = "cover";
                imageEl.style.borderRadius = "999px";
                imageEl.style.display = "block";
                imageEl.onerror = function () {
                    frameEl.replaceChildren();
                    frameEl.textContent = getDriverInitials(driverIdentifier);
                };
                frameEl.appendChild(imageEl);
                return;
            }
            frameEl.textContent = getDriverInitials(driverIdentifier);
        };
        var applyMarkerAppearance = function (markerEl, appearance) {
            var frameEl = markerEl.querySelector("[data-marker-frame]");
            var badgeEl = markerEl.querySelector("[data-marker-badge]");
            var arrowEl = markerEl.querySelector("[data-marker-arrow]");
            var online = appearance.onlineStatus === "online";
            var frameColor = online
                ? appearance.inside
                    ? "#22c55e"
                    : "#ef4444"
                : "#94a3b8";
            var arrowColor = appearance.inside ? "#16a34a" : "#dc2626";
            if (frameEl) {
                frameEl.style.borderColor = frameColor;
                frameEl.style.boxShadow = online
                    ? appearance.inside
                        ? "0 12px 28px rgba(34,197,94,0.28)"
                        : "0 12px 28px rgba(239,68,68,0.28)"
                    : "0 12px 28px rgba(148,163,184,0.24)";
            }
            if (badgeEl) {
                badgeEl.style.background = online ? "#22c55e" : "#94a3b8";
            }
            if (arrowEl) {
                arrowEl.style.background = online ? arrowColor : "#64748b";
                arrowEl.style.transform = "translate(-50%, -122%) rotate(".concat(appearance.bearing, "deg)");
            }
            markerEl.style.opacity = online ? "1" : "0.72";
        };
        var createMarkerElement = function (driverIdentifier, appearance) {
            var markerEl = document.createElement("div");
            markerEl.dataset.driverIdentifier = driverIdentifier;
            markerEl.style.width = "42px";
            markerEl.style.height = "42px";
            markerEl.style.position = "relative";
            markerEl.style.display = "flex";
            markerEl.style.alignItems = "center";
            markerEl.style.justifyContent = "center";
            markerEl.style.cursor = "pointer";
            var frameEl = document.createElement("div");
            frameEl.setAttribute("data-marker-frame", "true");
            frameEl.style.width = "36px";
            frameEl.style.height = "36px";
            frameEl.style.borderRadius = "999px";
            frameEl.style.border = "3px solid #22c55e";
            frameEl.style.background =
                "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.92))";
            frameEl.style.color = "#f8fafc";
            frameEl.style.display = "flex";
            frameEl.style.alignItems = "center";
            frameEl.style.justifyContent = "center";
            frameEl.style.fontSize = "12px";
            frameEl.style.fontWeight = "700";
            frameEl.style.fontFamily =
                "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
            frameEl.style.boxSizing = "border-box";
            var arrowEl = document.createElement("div");
            arrowEl.setAttribute("data-marker-arrow", "true");
            arrowEl.style.position = "absolute";
            arrowEl.style.left = "50%";
            arrowEl.style.top = "50%";
            arrowEl.style.width = "14px";
            arrowEl.style.height = "14px";
            arrowEl.style.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)";
            arrowEl.style.transformOrigin = "50% 50%";
            arrowEl.style.boxShadow = "0 6px 14px rgba(15,23,42,0.22)";
            arrowEl.style.pointerEvents = "none";
            var badgeEl = document.createElement("div");
            badgeEl.setAttribute("data-marker-badge", "true");
            badgeEl.style.position = "absolute";
            badgeEl.style.right = "4px";
            badgeEl.style.bottom = "3px";
            badgeEl.style.width = "11px";
            badgeEl.style.height = "11px";
            badgeEl.style.borderRadius = "999px";
            badgeEl.style.border = "2px solid #ffffff";
            badgeEl.style.background = "#22c55e";
            badgeEl.style.boxSizing = "border-box";
            markerEl.appendChild(arrowEl);
            markerEl.appendChild(frameEl);
            markerEl.appendChild(badgeEl);
            markerEl.title = getDriverLabel(driverIdentifier);
            renderMarkerFrameContent(markerEl, driverIdentifier);
            applyMarkerAppearance(markerEl, appearance);
            return markerEl;
        };
        var isDriverVisibleToAdmin = function (driverIdentifier) {
            var driver = getDriverRecord(driverIdentifier);
            if (!driver || driver.status !== "active")
                return false;
            if (adminProfile.role === "superadmin")
                return true;
            var normalized = driverIdentifier.trim().toUpperCase();
            var visible = visibleDriverIdentifiersRef.current;
            return visible.has(normalized) || visible.has(driverIdentifier);
        };
        var removeDriverState = function (driverIdentifier) {
            setDriversById(function (previous) {
                if (!(driverIdentifier in previous))
                    return previous;
                var next = __assign({}, previous);
                delete next[driverIdentifier];
                return next;
            });
        };
        var updateViolatorPresence = function (identifiers, driverOnlineStatus, lastSeenTs) {
            updateViolatorsByTokens(identifiers, function (violator) {
                var _a;
                return (__assign(__assign({}, violator), { driverOnlineStatus: driverOnlineStatus, lastSeenTs: (_a = lastSeenTs !== null && lastSeenTs !== void 0 ? lastSeenTs : violator.lastSeenTs) !== null && _a !== void 0 ? _a : null }));
            });
        };
        var setDriverOffline = function (driverIdentifier, identifiers, lastSeenTs) {
            var _a;
            updateViolatorPresence(identifiers, "offline", lastSeenTs);
            (_a = driverMarkerManagerRef.current) === null || _a === void 0 ? void 0 : _a.setOffline(__spreadArray([driverIdentifier], identifiers, true), lastSeenTs);
            setDriversById(function (previous) {
                var _a;
                var existing = previous[driverIdentifier];
                if (!existing)
                    return previous;
                return __assign(__assign({}, previous), (_a = {}, _a[driverIdentifier] = __assign(__assign({}, existing), { lastSeenTs: Math.max(existing.lastSeenTs, lastSeenTs !== null && lastSeenTs !== void 0 ? lastSeenTs : existing.lastSeenTs), onlineStatus: "offline" }), _a));
            });
        };
        var removeDriverLivePresence = function (driverIdentifier, identifiers) {
            var _a;
            updateViolatorPresence(identifiers, "offline");
            (_a = driverMarkerManagerRef.current) === null || _a === void 0 ? void 0 : _a.remove(__spreadArray([driverIdentifier], identifiers, true));
            removeDriverState(driverIdentifier);
        };
        var upsertDriverState = function (event, isViolation, onlineStatus, acceptedLocation) {
            if (acceptedLocation === void 0) { acceptedLocation = true; }
            setDriversById(function (previous) {
                var _a;
                var _b, _c, _d, _e, _f;
                var existing = previous[event.driverId];
                var dedupedRecent = acceptedLocation
                    ? __spreadArray([event], ((_b = existing === null || existing === void 0 ? void 0 : existing.recentPoints) !== null && _b !== void 0 ? _b : []), true).sort(function (a, b) { return b.ts - a.ts; })
                        .filter(function (point, index, all) {
                        var signature = createPointSignature(point);
                        return (index ===
                            all.findIndex(function (candidate) { return createPointSignature(candidate) === signature; }));
                    })
                        .slice(0, RECENT_POINTS_PER_DRIVER)
                    : ((_c = existing === null || existing === void 0 ? void 0 : existing.recentPoints) !== null && _c !== void 0 ? _c : []);
                return __assign(__assign({}, previous), (_a = {}, _a[event.driverId] = {
                    driverId: event.driverId,
                    lastSeenTs: Math.max((_d = existing === null || existing === void 0 ? void 0 : existing.lastSeenTs) !== null && _d !== void 0 ? _d : 0, event.ts),
                    latestPoint: acceptedLocation ? event : ((_e = existing === null || existing === void 0 ? void 0 : existing.latestPoint) !== null && _e !== void 0 ? _e : event),
                    violationCount: ((_f = existing === null || existing === void 0 ? void 0 : existing.violationCount) !== null && _f !== void 0 ? _f : 0) + (isViolation ? 1 : 0),
                    recentPoints: dedupedRecent,
                    onlineStatus: onlineStatus
                }, _a));
            });
        };
        map.on("style.load", function () {
            ensureGeofenceLayers(false);
        });
        map.on("idle", function () {
            ensureGeofenceLayers(false);
        });
        map.on("load", function () {
            ensureGeofenceLayers(true);
            driverMarkerManagerRef.current = (0, smooth_driver_markers_1.createSmoothDriverMarkerManager)({
                map: map,
                createMarkerElement: createMarkerElement,
                getPopupContent: createDriverPopupContent,
                updateMarkerElement: function (markerEl, appearance) {
                    var _a;
                    var driverIdentifier = (_a = markerEl.dataset.driverIdentifier) !== null && _a !== void 0 ? _a : "";
                    markerEl.title = getDriverLabel(driverIdentifier);
                    renderMarkerFrameContent(markerEl, driverIdentifier);
                    applyMarkerAppearance(markerEl, appearance);
                }
            });
            var updateMarker = function (event, inside, identifiers) {
                var _a, _b;
                return (_b = (_a = driverMarkerManagerRef.current) === null || _a === void 0 ? void 0 : _a.upsert({
                    driverIdentifier: event.driverId,
                    aliases: identifiers,
                    position: {
                        lng: event.lng,
                        lat: event.lat
                    },
                    timestamp: event.ts,
                    accuracy: event.accuracy,
                    heading: event.heading,
                    speed: event.speed,
                    inside: inside,
                    onlineStatus: "online"
                })) !== null && _b !== void 0 ? _b : { accepted: false, snapped: false, position: null };
            };
            var handleLocationEvent = function (event, identifiers) {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
                if (!isDriverVisibleToAdmin(event.driverId))
                    return;
                var inside = turf.booleanPointInPolygon(turf.point([event.lng, event.lat]), geofencePolygon);
                var driver = getDashboardDriverByIdentifier(event.driverId);
                var operationalState = driver && ((_a = dashboardDataRef.current) === null || _a === void 0 ? void 0 : _a.operationalDrivers.find(function (item) { return item.driverId === driver.driverId; }));
                var trip = getDashboardTripForViolation(driver === null || driver === void 0 ? void 0 : driver.driverId, (_b = event.tripId) !== null && _b !== void 0 ? _b : operationalState === null || operationalState === void 0 ? void 0 : operationalState.activeTripId);
                var activeTripId = (_d = (_c = event.tripId) !== null && _c !== void 0 ? _c : operationalState === null || operationalState === void 0 ? void 0 : operationalState.activeTripId) !== null && _d !== void 0 ? _d : trip === null || trip === void 0 ? void 0 : trip.tripId;
                var driverTokens = buildDriverTokens((_e = driver === null || driver === void 0 ? void 0 : driver.driverCode) !== null && _e !== void 0 ? _e : event.driverId, driver === null || driver === void 0 ? void 0 : driver.driverId);
                var driverKey = getViolatorDriverKey({
                    driverCode: (_f = driver === null || driver === void 0 ? void 0 : driver.driverCode) !== null && _f !== void 0 ? _f : event.driverId,
                    driverId: driver === null || driver === void 0 ? void 0 : driver.driverId
                });
                var previousInside = driverInsideStateRef.current[event.driverId];
                var hadLivePresenceBefore = Boolean(driversByIdRef.current[event.driverId]);
                var markerUpdate = updateMarker(event, inside, identifiers);
                upsertDriverState(event, !inside && markerUpdate.accepted, "online", markerUpdate.accepted);
                updateViolatorPresence(driverTokens, "online", event.ts);
                if (!markerUpdate.accepted) {
                    return;
                }
                var shouldTriggerLiveGeofenceAlert = !inside && Boolean(driverKey) && (previousInside !== false || !hadLivePresenceBefore);
                if (!inside && driverKey) {
                    upsertLiveViolator({
                        driverKey: driverKey,
                        driverId: (_g = driver === null || driver === void 0 ? void 0 : driver.driverCode) !== null && _g !== void 0 ? _g : event.driverId,
                        driverName: driver ? "".concat(driver.firstName, " ").concat(driver.lastName) : event.driverId,
                        avatarUrl: (_h = driver === null || driver === void 0 ? void 0 : driver.avatarUrl) !== null && _h !== void 0 ? _h : null,
                        latitude: event.lat,
                        longitude: event.lng,
                        violationType: "Outside geofence",
                        timestamp: new Date(event.ts).toISOString(),
                        status: "active",
                        violationId: "live-".concat(event.driverId, "-").concat(activeTripId !== null && activeTripId !== void 0 ? activeTripId : "no-trip", "-").concat(event.ts),
                        source: "live_geofence",
                        locationLabel: formatViolationCoordinates({ lat: event.lat, lng: event.lng }),
                        tripId: activeTripId,
                        routeName: (_j = trip === null || trip === void 0 ? void 0 : trip.routeName) !== null && _j !== void 0 ? _j : operationalState === null || operationalState === void 0 ? void 0 : operationalState.activeRouteName,
                        resolvedAt: null,
                        driverOnlineStatus: "online",
                        lastSeenTs: event.ts,
                        uiDismissedByAdmin: false,
                        driverTokens: driverTokens
                    });
                }
                driverInsideStateRef.current[event.driverId] = inside;
                if (!shouldTriggerLiveGeofenceAlert || !driverKey)
                    return;
                var timestamp = new Date(event.ts).toISOString();
                queueViolationAlert({
                    key: "live-geofence-".concat(event.driverId, "-").concat(createPointSignature(event)),
                    source: "live_geofence",
                    driverId: driver === null || driver === void 0 ? void 0 : driver.driverId,
                    driverCode: (_k = driver === null || driver === void 0 ? void 0 : driver.driverCode) !== null && _k !== void 0 ? _k : event.driverId,
                    driverName: driver ? "".concat(driver.firstName, " ").concat(driver.lastName) : undefined,
                    profileImageUrl: driver === null || driver === void 0 ? void 0 : driver.avatarUrl,
                    plateNo: (_m = (_l = driver === null || driver === void 0 ? void 0 : driver.tricycleNo) !== null && _l !== void 0 ? _l : operationalState === null || operationalState === void 0 ? void 0 : operationalState.plateNo) !== null && _m !== void 0 ? _m : trip === null || trip === void 0 ? void 0 : trip.plateNo,
                    tricycleNo: (_p = (_o = driver === null || driver === void 0 ? void 0 : driver.tricycleNo) !== null && _o !== void 0 ? _o : operationalState === null || operationalState === void 0 ? void 0 : operationalState.plateNo) !== null && _p !== void 0 ? _p : trip === null || trip === void 0 ? void 0 : trip.plateNo,
                    tricycleId: (_r = (_q = driver === null || driver === void 0 ? void 0 : driver.tricycleId) !== null && _q !== void 0 ? _q : operationalState === null || operationalState === void 0 ? void 0 : operationalState.tricycleId) !== null && _r !== void 0 ? _r : trip === null || trip === void 0 ? void 0 : trip.tricycleId,
                    tripId: activeTripId,
                    routeName: (_s = trip === null || trip === void 0 ? void 0 : trip.routeName) !== null && _s !== void 0 ? _s : operationalState === null || operationalState === void 0 ? void 0 : operationalState.activeRouteName,
                    violationType: "Geofence Deviation",
                    timestamp: timestamp,
                    locationLabel: formatViolationCoordinates({ lat: event.lat, lng: event.lng }),
                    description: "Driver went outside the active geofence boundary.",
                    lat: event.lat,
                    lng: event.lng
                });
            };
            var toLocationEventFromRow = function (row) {
                var _a, _b, _c, _d;
                return ({
                    type: "driver_location",
                    driverId: row.driver_code.trim().toUpperCase(),
                    ts: new Date((_a = row.recorded_at) !== null && _a !== void 0 ? _a : row.updated_at).getTime(),
                    lng: row.longitude,
                    lat: row.latitude,
                    speed: (_b = row.speed) !== null && _b !== void 0 ? _b : undefined,
                    heading: (_c = row.heading) !== null && _c !== void 0 ? _c : undefined,
                    accuracy: (_d = row.accuracy) !== null && _d !== void 0 ? _d : undefined
                });
            };
            var isLiveLocationRowOnline = function (row) {
                var _a;
                var lastSeenTs = new Date((_a = row.recorded_at) !== null && _a !== void 0 ? _a : row.updated_at).getTime();
                return row.is_online && isFreshPresence(lastSeenTs, Date.now());
            };
            var applyLocationRow = function (row) { return __awaiter(_this, void 0, void 0, function () {
                var driverIdentifier, identifiers, lastSeenTs, locationEvent;
                var _a;
                return __generator(this, function (_b) {
                    driverIdentifier = row.driver_code.trim().toUpperCase();
                    identifiers = [driverIdentifier, String(row.driver_id)];
                    lastSeenTs = new Date((_a = row.recorded_at) !== null && _a !== void 0 ? _a : row.updated_at).getTime();
                    if (!isLiveLocationRowOnline(row)) {
                        setDriverOffline(driverIdentifier, identifiers, lastSeenTs);
                        return [2 /*return*/];
                    }
                    locationEvent = toLocationEventFromRow(row);
                    if (!isDriverVisibleToAdmin(locationEvent.driverId)) {
                        removeDriverLivePresence(driverIdentifier, identifiers);
                        return [2 /*return*/];
                    }
                    handleLocationEvent(locationEvent, identifiers);
                    if (active)
                        setLastUpdateTs(locationEvent.ts);
                    return [2 /*return*/];
                });
            }); };
            var loadLiveDriverLocations = function () { return __awaiter(_this, void 0, void 0, function () {
                var hiddenIdentifiers, _i, hiddenIdentifiers_1, driverIdentifier, _a, data, error, onlineIdentifiers, _b, _c, row, staleIdentifiers, _d, staleIdentifiers_1, driverIdentifier, lastSeenTs;
                var _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            hiddenIdentifiers = Object.keys(driversByIdRef.current).filter(function (driverIdentifier) { return !isDriverVisibleToAdmin(driverIdentifier); });
                            if (hiddenIdentifiers.length > 0) {
                                for (_i = 0, hiddenIdentifiers_1 = hiddenIdentifiers; _i < hiddenIdentifiers_1.length; _i++) {
                                    driverIdentifier = hiddenIdentifiers_1[_i];
                                    removeDriverLivePresence(driverIdentifier, [driverIdentifier]);
                                }
                            }
                            setSyncStatus("connecting");
                            return [4 /*yield*/, supabase_1.supabase
                                    .from("driver_locations")
                                    .select("driver_id,driver_code,latitude,longitude,speed,heading,accuracy,is_online,recorded_at,updated_at")
                                    .eq("is_online", true)
                                    .gte("updated_at", new Date(Date.now() - DRIVER_PRESENCE_STALE_MS).toISOString())];
                        case 1:
                            _a = _f.sent(), data = _a.data, error = _a.error;
                            if (error) {
                                console.warn("Live driver location hydration failed:", error.message);
                                if (active)
                                    setSyncStatus("disconnected");
                                return [2 /*return*/];
                            }
                            onlineIdentifiers = new Set();
                            _b = 0, _c = (data !== null && data !== void 0 ? data : []);
                            _f.label = 2;
                        case 2:
                            if (!(_b < _c.length)) return [3 /*break*/, 5];
                            row = _c[_b];
                            onlineIdentifiers.add(row.driver_code.trim().toUpperCase());
                            onlineIdentifiers.add(String(row.driver_id));
                            return [4 /*yield*/, applyLocationRow(row)];
                        case 3:
                            _f.sent();
                            _f.label = 4;
                        case 4:
                            _b++;
                            return [3 /*break*/, 2];
                        case 5:
                            staleIdentifiers = Object.keys(driversByIdRef.current).filter(function (driverIdentifier) { return !onlineIdentifiers.has(driverIdentifier); });
                            if (staleIdentifiers.length > 0) {
                                for (_d = 0, staleIdentifiers_1 = staleIdentifiers; _d < staleIdentifiers_1.length; _d++) {
                                    driverIdentifier = staleIdentifiers_1[_d];
                                    lastSeenTs = (_e = driversByIdRef.current[driverIdentifier]) === null || _e === void 0 ? void 0 : _e.lastSeenTs;
                                    setDriverOffline(driverIdentifier, [driverIdentifier], lastSeenTs);
                                }
                            }
                            if (active) {
                                setLivePresenceHydrated(true);
                                setSyncStatus("connected");
                            }
                            return [2 /*return*/];
                    }
                });
            }); };
            refreshLiveLocationsRef.current = function () {
                void loadLiveDriverLocations();
            };
            var connectRealtime = function () {
                if (!active)
                    return;
                if (liveLocationChannel) {
                    void supabase_1.supabase.removeChannel(liveLocationChannel);
                    liveLocationChannel = null;
                }
                if (dashboardEventChannel) {
                    void supabase_1.supabase.removeChannel(dashboardEventChannel);
                    dashboardEventChannel = null;
                }
                setSyncStatus("connecting");
                liveLocationChannel = supabase_1.supabase
                    .channel("driver-locations-".concat(adminProfile.adminId))
                    .on("postgres_changes", {
                    event: "*",
                    schema: "public",
                    table: "driver_locations"
                }, function (payload) {
                    var _a, _b;
                    if (!active)
                        return;
                    var previousRow = payload.old;
                    var nextRow = payload.new;
                    var row = (nextRow || previousRow);
                    if (!row)
                        return;
                    var driverIdentifier = row.driver_code.trim().toUpperCase();
                    if (payload.eventType === "DELETE") {
                        removeDriverLivePresence(driverIdentifier, [
                            driverIdentifier,
                            String(row.driver_id)
                        ]);
                        scheduleDashboardRefresh();
                        return;
                    }
                    if (((_a = nextRow === null || nextRow === void 0 ? void 0 : nextRow.is_online) !== null && _a !== void 0 ? _a : null) !== ((_b = previousRow === null || previousRow === void 0 ? void 0 : previousRow.is_online) !== null && _b !== void 0 ? _b : null)) {
                        scheduleDashboardRefresh();
                    }
                    void applyLocationRow(row);
                })
                    .subscribe(function (status) {
                    if (!active)
                        return;
                    if (status === "SUBSCRIBED") {
                        setSyncStatus("connected");
                        return;
                    }
                    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
                        setSyncStatus("disconnected");
                    }
                });
                dashboardEventChannel = supabase_1.supabase
                    .channel("dashboard-events-".concat(adminProfile.adminId))
                    .on("postgres_changes", {
                    event: "*",
                    schema: "public",
                    table: "trips"
                }, function () {
                    if (!active)
                        return;
                    scheduleDashboardRefresh();
                })
                    .on("postgres_changes", {
                    event: "*",
                    schema: "public",
                    table: "mobile_violations"
                }, function (payload) {
                    if (!active)
                        return;
                    if (payload.eventType === "INSERT") {
                        var insertedRow = payload.new;
                        if (typeof (insertedRow === null || insertedRow === void 0 ? void 0 : insertedRow.id) === "string" && insertedRow.id.trim()) {
                            var violationKey = getStoredViolationKey("driver_violation", "driver-".concat(insertedRow.id));
                            if (!knownViolationKeysRef.current.has(violationKey) &&
                                !shownViolationPopupKeysRef.current.has(violationKey)) {
                                pendingViolationPopupKeysRef.current.add(violationKey);
                            }
                        }
                    }
                    scheduleDashboardRefresh();
                })
                    .on("postgres_changes", {
                    event: "*",
                    schema: "public",
                    table: "violations"
                }, function (payload) {
                    if (!active)
                        return;
                    if (payload.eventType === "INSERT") {
                        var insertedRow = payload.new;
                        if ((insertedRow === null || insertedRow === void 0 ? void 0 : insertedRow.violation_id) !== undefined &&
                            insertedRow.violation_id !== null &&
                            String(insertedRow.violation_id).trim()) {
                            var violationKey = getStoredViolationKey("system_violation", "system-".concat(String(insertedRow.violation_id)));
                            if (!knownViolationKeysRef.current.has(violationKey) &&
                                !shownViolationPopupKeysRef.current.has(violationKey)) {
                                pendingViolationPopupKeysRef.current.add(violationKey);
                            }
                        }
                    }
                    scheduleDashboardRefresh();
                })
                    .on("postgres_changes", {
                    event: "*",
                    schema: "public",
                    table: "drivers"
                }, function () {
                    if (!active)
                        return;
                    scheduleDashboardRefresh();
                })
                    .subscribe();
            };
            var handleOnlineState = function () {
                var isOnline = navigator.onLine;
                setOnline(isOnline);
                if (isOnline) {
                    void loadLiveDriverLocations();
                    connectRealtime();
                }
                else {
                    setSyncStatus("disconnected");
                }
            };
            onlineHandler = handleOnlineState;
            window.addEventListener("online", handleOnlineState);
            window.addEventListener("offline", handleOnlineState);
            void loadLiveDriverLocations();
            connectRealtime();
            stalePresenceTimer = window.setInterval(function () {
                var nowTs = Date.now();
                var staleIdentifiers = Object.entries(driversByIdRef.current).filter(function (_a) {
                    var driverState = _a[1];
                    return driverState.onlineStatus === "online" && !isFreshPresence(driverState.lastSeenTs, nowTs);
                });
                for (var _i = 0, staleIdentifiers_2 = staleIdentifiers; _i < staleIdentifiers_2.length; _i++) {
                    var _a = staleIdentifiers_2[_i], driverIdentifier = _a[0], driverState = _a[1];
                    setDriverOffline(driverIdentifier, [driverIdentifier], driverState.lastSeenTs);
                }
            }, 15000);
        });
        return function () {
            var _a, _b;
            active = false;
            if (refreshLiveLocationsRef.current) {
                refreshLiveLocationsRef.current = null;
            }
            if (liveLocationChannel) {
                void supabase_1.supabase.removeChannel(liveLocationChannel);
            }
            if (dashboardEventChannel) {
                void supabase_1.supabase.removeChannel(dashboardEventChannel);
            }
            if (dashboardRefreshTimer) {
                window.clearTimeout(dashboardRefreshTimer);
            }
            if (stalePresenceTimer) {
                window.clearInterval(stalePresenceTimer);
            }
            if (onlineHandler) {
                window.removeEventListener("online", onlineHandler);
                window.removeEventListener("offline", onlineHandler);
            }
            ensureGeofenceLayersRef.current = null;
            (_a = driverMarkerManagerRef.current) === null || _a === void 0 ? void 0 : _a.destroy();
            driverMarkerManagerRef.current = null;
            (_b = violationFocusMarkerRef.current) === null || _b === void 0 ? void 0 : _b.remove();
            violationFocusMarkerRef.current = null;
            map.remove();
            mapRef.current = null;
            geofenceBoundsRef.current = null;
        };
    }, [accessToken, adminProfile.adminId, adminProfile.role]);
    (0, react_1.useEffect)(function () {
        if (showLiveMapView && mapRef.current) {
            window.setTimeout(function () {
                var _a, _b;
                (_a = mapRef.current) === null || _a === void 0 ? void 0 : _a.resize();
                (_b = ensureGeofenceLayersRef.current) === null || _b === void 0 ? void 0 : _b.call(ensureGeofenceLayersRef, activePage === "live-map");
            }, 0);
        }
    }, [activePage, showLiveMapView]);
    (0, react_1.useEffect)(function () {
        var _a, _b;
        var map = mapRef.current;
        if (!map)
            return;
        if (appliedMapStyleRef.current === selectedMapStyle) {
            (_a = ensureGeofenceLayersRef.current) === null || _a === void 0 ? void 0 : _a.call(ensureGeofenceLayersRef, false);
            return;
        }
        appliedMapStyleRef.current = selectedMapStyle;
        map.setStyle((0, map_basemaps_1.createRasterStyle)(selectedMapStyle));
        (_b = ensureGeofenceLayersRef.current) === null || _b === void 0 ? void 0 : _b.call(ensureGeofenceLayersRef, false);
    }, [selectedMapStyle]);
    (0, react_1.useEffect)(function () {
        var _a;
        var map = mapRef.current;
        if (!map || !selectedViolator || !showLiveMapView) {
            if (!selectedViolator) {
                (_a = violationFocusMarkerRef.current) === null || _a === void 0 ? void 0 : _a.remove();
                violationFocusMarkerRef.current = null;
            }
            setSelectedViolationPopupPosition(null);
            return;
        }
        var animationFrameId = null;
        var getLngLat = function () {
            var _a;
            var livePosition = (_a = driverMarkerManagerRef.current) === null || _a === void 0 ? void 0 : _a.getDisplayedPosition(getViolatorTrackingIdentifiers(selectedViolator));
            return livePosition
                ? [livePosition.lng, livePosition.lat]
                : [selectedViolator.longitude, selectedViolator.latitude];
        };
        var syncPopupPosition = function () {
            var lngLat = getLngLat();
            if (!violationFocusMarkerRef.current) {
                violationFocusMarkerRef.current = new maplibre_gl_1.default.Marker({
                    element: createViolationMarkerElement()
                })
                    .setLngLat(lngLat)
                    .addTo(map);
            }
            else {
                violationFocusMarkerRef.current.setLngLat(lngLat);
            }
            var point = map.project(lngLat);
            var container = map.getContainer();
            var align = point.x > container.clientWidth - 280 ? "left" : "right";
            setSelectedViolationPopupPosition({
                x: Math.round(point.x),
                y: Math.round(point.y),
                align: align
            });
        };
        syncPopupPosition();
        map.on("move", syncPopupPosition);
        map.on("zoom", syncPopupPosition);
        map.on("resize", syncPopupPosition);
        var syncDuringAnimation = function () {
            syncPopupPosition();
            animationFrameId = window.requestAnimationFrame(syncDuringAnimation);
        };
        animationFrameId = window.requestAnimationFrame(syncDuringAnimation);
        return function () {
            if (animationFrameId !== null) {
                window.cancelAnimationFrame(animationFrameId);
            }
            map.off("move", syncPopupPosition);
            map.off("zoom", syncPopupPosition);
            map.off("resize", syncPopupPosition);
        };
    }, [selectedViolator, showLiveMapView]);
    var handleViolatorSelect = function (violator) {
        if (selectedViolatorKey === violator.driverKey) {
            setSelectedViolatorKey(null);
            return;
        }
        setSelectedViolatorKey(violator.driverKey);
        setActivePage("live-map");
        window.setTimeout(function () {
            var _a;
            var map = mapRef.current;
            if (!map)
                return;
            var livePosition = (_a = driverMarkerManagerRef.current) === null || _a === void 0 ? void 0 : _a.getDisplayedPosition(getViolatorTrackingIdentifiers(violator));
            map.resize();
            map.flyTo({
                center: livePosition
                    ? [livePosition.lng, livePosition.lat]
                    : [violator.longitude, violator.latitude],
                zoom: Math.max(map.getZoom(), 16.2),
                speed: 0.95,
                curve: 1.3,
                essential: true
            });
        }, 80);
    };
    var operationalDriversById = (0, react_1.useMemo)(function () {
        var _a;
        return new Map(((_a = dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.operationalDrivers) !== null && _a !== void 0 ? _a : []).map(function (driver) { return [driver.driverId, driver]; }));
    }, [dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.operationalDrivers]);
    var driverDirectoryRows = (0, react_1.useMemo)(function () {
        var _a, _b;
        var directory = new Map();
        for (var _i = 0, _c = (_a = dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.drivers) !== null && _a !== void 0 ? _a : []; _i < _c.length; _i++) {
            var driver = _c[_i];
            var numericDriverId = String(driver.driverId);
            directory.set(numericDriverId, __assign(__assign({}, driver), { liveState: (_b = driversById[driver.driverCode]) !== null && _b !== void 0 ? _b : driversById[numericDriverId], operationalState: operationalDriversById.get(driver.driverId) }));
        }
        return __spreadArray([], directory.values(), true).sort(function (a, b) {
            var _a, _b, _c, _d;
            var aLastSeen = (_b = (_a = a.liveState) === null || _a === void 0 ? void 0 : _a.lastSeenTs) !== null && _b !== void 0 ? _b : 0;
            var bLastSeen = (_d = (_c = b.liveState) === null || _c === void 0 ? void 0 : _c.lastSeenTs) !== null && _d !== void 0 ? _d : 0;
            if (aLastSeen !== bLastSeen)
                return bLastSeen - aLastSeen;
            return "".concat(a.lastName, " ").concat(a.firstName).localeCompare("".concat(b.lastName, " ").concat(b.firstName));
        });
    }, [dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.drivers, driversById, operationalDriversById]);
    var activeDriverRows = (0, react_1.useMemo)(function () {
        return driverDirectoryRows.filter(function (driver) {
            return isDriverOnlineNow(driver, clockTs, livePresenceHydrated);
        });
    }, [driverDirectoryRows, clockTs, livePresenceHydrated]);
    var selectedDriver = (0, react_1.useMemo)(function () {
        var _a;
        if (selectedDriverId === null)
            return null;
        return (_a = driverDirectoryRows.find(function (driver) { return driver.driverId === selectedDriverId; })) !== null && _a !== void 0 ? _a : null;
    }, [driverDirectoryRows, selectedDriverId]);
    var activeDriverCount = activeDriverRows.length;
    var systemDriverStats = (0, react_1.useMemo)(function () {
        var inTransitCount = driverDirectoryRows.filter(function (driver) { var _a; return ((_a = driver.operationalState) === null || _a === void 0 ? void 0 : _a.operationalStatus) === "on_trip"; }).length;
        var idleCount = driverDirectoryRows.filter(function (driver) {
            var _a, _b;
            return ((_a = driver.operationalState) === null || _a === void 0 ? void 0 : _a.operationalStatus) === "online_idle" ||
                (isDriverOnlineNow(driver, clockTs, livePresenceHydrated) &&
                    ((_b = driver.operationalState) === null || _b === void 0 ? void 0 : _b.operationalStatus) !== "on_trip");
        }).length;
        var setupPendingCount = driverDirectoryRows.filter(function (driver) { return !driver.passwordSet; }).length;
        return {
            total: driverDirectoryRows.length,
            active: activeDriverCount,
            inTransit: inTransitCount,
            idle: idleCount,
            setupPending: setupPendingCount
        };
    }, [activeDriverCount, clockTs, driverDirectoryRows, livePresenceHydrated]);
    var activeTricycleCount = (0, react_1.useMemo)(function () {
        var _a;
        var activeTricycleKeys = new Set();
        for (var _i = 0, activeDriverRows_1 = activeDriverRows; _i < activeDriverRows_1.length; _i++) {
            var driver = activeDriverRows_1[_i];
            if (driver.tricycleId) {
                activeTricycleKeys.add("id:".concat(driver.tricycleId));
                continue;
            }
            var normalizedTricycleNo = (_a = driver.tricycleNo) === null || _a === void 0 ? void 0 : _a.trim().toUpperCase();
            if (normalizedTricycleNo) {
                activeTricycleKeys.add("plate:".concat(normalizedTricycleNo));
                continue;
            }
            activeTricycleKeys.add("driver:".concat(driver.driverId));
        }
        return activeTricycleKeys.size;
    }, [activeDriverRows]);
    var totalTripsToday = (0, react_1.useMemo)(function () {
        var _a;
        return (_a = dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.counts.tripsToday) !== null && _a !== void 0 ? _a : 0;
    }, [dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.counts.tripsToday]);
    var filteredAllDriverRows = (0, react_1.useMemo)(function () {
        if (!hasSearchQuery)
            return driverDirectoryRows;
        return driverDirectoryRows.filter(function (driver) {
            return driverMatchesSearch(driver, normalizedSearchQuery);
        });
    }, [driverDirectoryRows, hasSearchQuery, normalizedSearchQuery]);
    var filteredActiveDriverRows = (0, react_1.useMemo)(function () {
        if (!hasSearchQuery)
            return activeDriverRows;
        return activeDriverRows.filter(function (driver) {
            return driverMatchesSearch(driver, normalizedSearchQuery);
        });
    }, [activeDriverRows, hasSearchQuery, normalizedSearchQuery]);
    var alertRows = (0, react_1.useMemo)(function () {
        var _a, _b;
        return __spreadArray(__spreadArray([], ((_a = dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.recentEmergencies) !== null && _a !== void 0 ? _a : []).map(createStoredEmergencyAlertListItem), true), ((_b = dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.recentViolations) !== null && _b !== void 0 ? _b : []).map(createStoredAlertListItem), true).sort(function (a, b) { return b.ts - a.ts; });
    }, [dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.recentEmergencies, dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.recentViolations]);
    var filteredAlerts = (0, react_1.useMemo)(function () {
        if (!hasSearchQuery)
            return alertRows;
        return alertRows.filter(function (alert) {
            var point = alert.lat !== undefined && alert.lng !== undefined
                ? "".concat(alert.lat.toFixed(5), ", ").concat(alert.lng.toFixed(5))
                : "";
            return (textMatchesSearch(normalizedSearchQuery, alert.key, alert.driverId, alert.driverName, alert.reason, alert.description, alert.plateNo, alert.routeName, alert.todaName, alert.barangayName, alert.status, alert.source, alert.emergencyId, point));
        });
    }, [alertRows, hasSearchQuery, normalizedSearchQuery]);
    var alertStats = (0, react_1.useMemo)(function () {
        var open = alertRows.filter(function (item) { return item.status === "open"; }).length;
        var emergency = alertRows.filter(function (item) { return item.source === "emergency"; }).length;
        var resolved = alertRows.filter(function (item) { return item.status === "resolved"; }).length;
        return {
            total: alertRows.length,
            open: open,
            emergency: emergency,
            resolved: resolved
        };
    }, [alertRows]);
    var homeAlertSummary = (0, react_1.useMemo)(function () {
        return __spreadArray([], filteredAlerts, true).sort(function (a, b) { return b.ts - a.ts || String(b.key).localeCompare(String(a.key)); })
            .slice(0, HOME_ALERT_SUMMARY_LIMIT);
    }, [filteredAlerts]);
    var tripRows = (0, react_1.useMemo)(function () {
        var _a;
        return (_a = dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.recentTrips) !== null && _a !== void 0 ? _a : [];
    }, [dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.recentTrips]);
    var notificationItems = (0, react_1.useMemo)(function () {
        var _a;
        return ((_a = dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.notifications) !== null && _a !== void 0 ? _a : [])
            .map(function (item) { return ({
            key: item.notificationKey,
            kind: item.kind,
            page: item.page,
            title: item.title,
            body: item.body,
            ts: new Date(item.timestamp).getTime(),
            priority: item.priority,
            tone: item.tone,
            sourceEntityId: item.sourceEntityId,
            isRead: item.isRead
        }); })
            .sort(sortNotificationsByRecency);
    }, [dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.notifications]);
    (0, react_1.useEffect)(function () {
        var _a;
        var pending = ((_a = dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.recentEmergencies) !== null && _a !== void 0 ? _a : []).filter(function (item) { return item.status === "created" || item.status === "pending_admin"; });
        if (pending.length === 0) {
            if (activeEmergencyModal && activeEmergencyModal.status !== "responding") {
                setActiveEmergencyModal(null);
            }
            setEmergencyQueue([]);
            return;
        }
        var sorted = __spreadArray([], pending, true).sort(function (a, b) {
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
                b.emergencyId - a.emergencyId;
        });
        setEmergencyQueue(function (current) {
            var next = __spreadArray([], current, true);
            var _loop_1 = function (item) {
                if (!next.some(function (queued) { return queued.emergencyId === item.emergencyId; }) &&
                    (activeEmergencyModal === null || activeEmergencyModal === void 0 ? void 0 : activeEmergencyModal.emergencyId) !== item.emergencyId) {
                    next.push(item);
                }
            };
            for (var _i = 0, sorted_1 = sorted; _i < sorted_1.length; _i++) {
                var item = sorted_1[_i];
                _loop_1(item);
            }
            return next;
        });
        if (!activeEmergencyModal ||
            !sorted.some(function (item) { return item.emergencyId === activeEmergencyModal.emergencyId; })) {
            setActiveEmergencyModal(sorted[0]);
        }
    }, [dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.recentEmergencies, activeEmergencyModal]);
    (0, react_1.useEffect)(function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        var violations = (_a = dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.recentViolations) !== null && _a !== void 0 ? _a : [];
        var outsideGeofenceViolations = violations
            .filter(function (violation) { return isOutsideGeofenceViolation(violation); })
            .map(function (violation) {
            var _a, _b;
            var resolvedAt = (_b = (_a = violation
                .resolvedAt) !== null && _a !== void 0 ? _a : violation
                .resolved_at) !== null && _b !== void 0 ? _b : null;
            return {
                violation: violation,
                resolvedAt: resolvedAt,
                active: isViolatorActive({ status: violation.status, resolvedAt: resolvedAt })
            };
        });
        var hasAnyTodayViolation = outsideGeofenceViolations.some(function (_a) {
            var violation = _a.violation, active = _a.active;
            return active && isSameLocalCalendarDay(new Date(violation.detectedAt).getTime(), clockTs);
        });
        var closedStoredDismissalKeys = new Set(outsideGeofenceViolations
            .filter(function (_a) {
            var active = _a.active;
            return !active;
        })
            .map(function (_a) {
            var violation = _a.violation;
            return getViolatorDismissalKey({
                source: violation.alertSource,
                violationId: String(violation.violationId)
            });
        }));
        setStoredViolatorsByKey(function (current) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
            var next = __assign({}, current);
            var changed = false;
            for (var _i = 0, _r = Object.entries(current); _i < _r.length; _i++) {
                var _s = _r[_i], driverKey = _s[0], violator = _s[1];
                if ((violator.source === "system_violation" || violator.source === "driver_violation") &&
                    closedStoredDismissalKeys.has(getViolatorDismissalKey(violator))) {
                    delete next[driverKey];
                    changed = true;
                }
            }
            var _loop_3 = function (violation, resolvedAt, active) {
                if (!active)
                    return "continue";
                var driver = violation.driverId
                    ? dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.drivers.find(function (item) { return item.driverId === violation.driverId; })
                    : undefined;
                if (!driver) {
                    return "continue";
                }
                var operationalState = violation.driverId
                    ? dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.operationalDrivers.find(function (item) { return item.driverId === violation.driverId; })
                    : undefined;
                var liveState = driver
                    ? (_a = driversByIdRef.current[driver.driverCode]) !== null && _a !== void 0 ? _a : driversByIdRef.current[String(driver.driverId)]
                    : undefined;
                var latitude = (_c = (_b = violation.latitude) !== null && _b !== void 0 ? _b : operationalState === null || operationalState === void 0 ? void 0 : operationalState.latitude) !== null && _c !== void 0 ? _c : liveState === null || liveState === void 0 ? void 0 : liveState.latestPoint.lat;
                var longitude = (_e = (_d = violation.longitude) !== null && _d !== void 0 ? _d : operationalState === null || operationalState === void 0 ? void 0 : operationalState.longitude) !== null && _e !== void 0 ? _e : liveState === null || liveState === void 0 ? void 0 : liveState.latestPoint.lng;
                if (typeof latitude !== "number" || typeof longitude !== "number")
                    return "continue";
                var driverKey = getViolatorDriverKey({
                    driverCode: (_f = violation.driverCode) !== null && _f !== void 0 ? _f : driver === null || driver === void 0 ? void 0 : driver.driverCode,
                    driverId: violation.driverId
                });
                if (!driverKey)
                    return "continue";
                var nextViolator = {
                    driverKey: driverKey,
                    driverId: (_h = (_g = violation.driverCode) !== null && _g !== void 0 ? _g : driver === null || driver === void 0 ? void 0 : driver.driverCode) !== null && _h !== void 0 ? _h : String((_j = violation.driverId) !== null && _j !== void 0 ? _j : "N/A"),
                    driverName: (_k = violation.driverName) !== null && _k !== void 0 ? _k : (driver ? "".concat(driver.firstName, " ").concat(driver.lastName) : "Unknown driver"),
                    avatarUrl: (_l = driver === null || driver === void 0 ? void 0 : driver.avatarUrl) !== null && _l !== void 0 ? _l : null,
                    latitude: latitude,
                    longitude: longitude,
                    violationType: "Outside geofence",
                    timestamp: violation.detectedAt,
                    status: violation.status,
                    violationId: String(violation.violationId),
                    source: violation.alertSource,
                    locationLabel: (_m = violation.locationLabel) !== null && _m !== void 0 ? _m : formatViolationCoordinates({ lat: latitude, lng: longitude }),
                    tripId: violation.tripId,
                    routeName: (_o = violation.routeName) !== null && _o !== void 0 ? _o : operationalState === null || operationalState === void 0 ? void 0 : operationalState.activeRouteName,
                    resolvedAt: resolvedAt,
                    driverOnlineStatus: liveState ? "online" : "offline",
                    lastSeenTs: (_p = liveState === null || liveState === void 0 ? void 0 : liveState.lastSeenTs) !== null && _p !== void 0 ? _p : null,
                    uiDismissedByAdmin: false,
                    driverTokens: buildDriverTokens((_q = violation.driverCode) !== null && _q !== void 0 ? _q : driver === null || driver === void 0 ? void 0 : driver.driverCode, violation.driverId)
                };
                var dismissalKey = getViolatorDismissalKey(nextViolator);
                var existing = current[driverKey];
                var keepExistingViolation = existing && getViolatorDismissalKey(existing) === dismissalKey;
                var qualifiesNow = keepExistingViolation ||
                    qualifiesForFreshViolatorStack(nextViolator.timestamp, clockTs, hasAnyTodayViolation);
                var dismissedState = dismissedViolatorsByDriver[driverKey];
                var isCurrentViolationDismissed = (dismissedState === null || dismissedState === void 0 ? void 0 : dismissedState.dismissalKey) === dismissalKey;
                if (!qualifiesNow || isCurrentViolationDismissed) {
                    return "continue";
                }
                var existingByDriver = next[driverKey];
                if (existingByDriver &&
                    existingByDriver.violationId === nextViolator.violationId &&
                    existingByDriver.timestamp === nextViolator.timestamp &&
                    existingByDriver.latitude === nextViolator.latitude &&
                    existingByDriver.longitude === nextViolator.longitude &&
                    existingByDriver.driverOnlineStatus === nextViolator.driverOnlineStatus &&
                    existingByDriver.lastSeenTs === nextViolator.lastSeenTs) {
                    return "continue";
                }
                next[driverKey] = nextViolator;
                changed = true;
            };
            for (var _t = 0, outsideGeofenceViolations_1 = outsideGeofenceViolations; _t < outsideGeofenceViolations_1.length; _t++) {
                var _u = outsideGeofenceViolations_1[_t], violation = _u.violation, resolvedAt = _u.resolvedAt, active = _u.active;
                _loop_3(violation, resolvedAt, active);
            }
            return changed ? next : current;
        });
        var nextKnownKeys = new Set(violations.map(function (item) { return getStoredViolationKey(item.alertSource, item.violationId); }));
        if (!violationsHydratedRef.current) {
            knownViolationKeysRef.current = nextKnownKeys;
            violationsHydratedRef.current = true;
            return;
        }
        var newViolations = violations
            .filter(function (item) {
            var key = getStoredViolationKey(item.alertSource, item.violationId);
            return pendingViolationPopupKeysRef.current.has(key);
        })
            .sort(function (a, b) {
            return new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime();
        });
        knownViolationKeysRef.current = nextKnownKeys;
        var _loop_2 = function (violation) {
            var violationKey = getStoredViolationKey(violation.alertSource, violation.violationId);
            pendingViolationPopupKeysRef.current.delete(violationKey);
            if (violation.status !== "open" && violation.status !== "under_review")
                return "continue";
            if (shownViolationPopupKeysRef.current.has(violationKey))
                return "continue";
            var driver = violation.driverId
                ? dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.drivers.find(function (item) { return item.driverId === violation.driverId; })
                : undefined;
            if (!driver)
                return "continue";
            var operationalState = violation.driverId
                ? dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.operationalDrivers.find(function (item) { return item.driverId === violation.driverId; })
                : undefined;
            var trip = getDashboardTripForViolation(violation.driverId, violation.tripId);
            var activeTripId = (_c = (_b = violation.tripId) !== null && _b !== void 0 ? _b : operationalState === null || operationalState === void 0 ? void 0 : operationalState.activeTripId) !== null && _c !== void 0 ? _c : trip === null || trip === void 0 ? void 0 : trip.tripId;
            var hasActiveTrip = activeTripId !== undefined ||
                (operationalState === null || operationalState === void 0 ? void 0 : operationalState.operationalStatus) === "on_trip" ||
                (trip === null || trip === void 0 ? void 0 : trip.tripStatus) === "ongoing";
            if (!hasActiveTrip)
                return "continue";
            var lat = (_d = violation.latitude) !== null && _d !== void 0 ? _d : operationalState === null || operationalState === void 0 ? void 0 : operationalState.latitude;
            var lng = (_e = violation.longitude) !== null && _e !== void 0 ? _e : operationalState === null || operationalState === void 0 ? void 0 : operationalState.longitude;
            var coordinates = formatViolationCoordinates({ lat: lat, lng: lng });
            queueViolationAlert({
                key: "stored-".concat(violation.alertSource, "-").concat(violation.violationId),
                source: violation.alertSource,
                driverId: violation.driverId,
                driverCode: (_f = violation.driverCode) !== null && _f !== void 0 ? _f : driver === null || driver === void 0 ? void 0 : driver.driverCode,
                driverName: (_g = violation.driverName) !== null && _g !== void 0 ? _g : (driver ? "".concat(driver.firstName, " ").concat(driver.lastName) : undefined),
                profileImageUrl: driver === null || driver === void 0 ? void 0 : driver.avatarUrl,
                plateNo: (_j = (_h = violation.plateNo) !== null && _h !== void 0 ? _h : driver === null || driver === void 0 ? void 0 : driver.tricycleNo) !== null && _j !== void 0 ? _j : trip === null || trip === void 0 ? void 0 : trip.plateNo,
                tricycleNo: (_l = (_k = violation.plateNo) !== null && _k !== void 0 ? _k : driver === null || driver === void 0 ? void 0 : driver.tricycleNo) !== null && _l !== void 0 ? _l : trip === null || trip === void 0 ? void 0 : trip.plateNo,
                tricycleId: (_o = (_m = violation.tricycleId) !== null && _m !== void 0 ? _m : driver === null || driver === void 0 ? void 0 : driver.tricycleId) !== null && _o !== void 0 ? _o : trip === null || trip === void 0 ? void 0 : trip.tricycleId,
                tripId: activeTripId,
                routeName: (_q = (_p = violation.routeName) !== null && _p !== void 0 ? _p : trip === null || trip === void 0 ? void 0 : trip.routeName) !== null && _q !== void 0 ? _q : operationalState === null || operationalState === void 0 ? void 0 : operationalState.activeRouteName,
                violationType: violation.violationTypeLabel,
                timestamp: violation.detectedAt,
                locationLabel: (_r = violation.locationLabel) !== null && _r !== void 0 ? _r : coordinates,
                description: violation.description,
                lat: lat,
                lng: lng
            });
            shownViolationPopupKeysRef.current.add(violationKey);
        };
        for (var _i = 0, newViolations_1 = newViolations; _i < newViolations_1.length; _i++) {
            var violation = newViolations_1[_i];
            _loop_2(violation);
        }
    }, [
        clockTs,
        dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.recentViolations,
        dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.drivers,
        dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.operationalDrivers,
        dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.recentTrips,
        dismissedViolatorsByDriver,
        driversById
    ]);
    (0, react_1.useEffect)(function () {
        if (!selectedViolatorKey)
            return;
        if (activeViolators.some(function (violator) { return violator.driverKey === selectedViolatorKey; }))
            return;
        setSelectedViolatorKey(null);
    }, [activeViolators, selectedViolatorKey]);
    (0, react_1.useEffect)(function () {
        var closeStream = (0, emergencies_1.connectAdminEmergencyStream)(accessToken, {
            onSnapshot: function (items) {
                var pending = items
                    .filter(function (item) { return item.status === "created" || item.status === "pending_admin"; })
                    .sort(function (a, b) {
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
                        b.emergencyId - a.emergencyId;
                });
                setActiveEmergencyModal(function (current) { var _a; return (_a = current !== null && current !== void 0 ? current : pending[0]) !== null && _a !== void 0 ? _a : null; });
            },
            onEmergency: function (alert) {
                if (alert.status === "created" || alert.status === "pending_admin") {
                    setEmergencyQueue(function (current) {
                        var withoutCurrent = current.filter(function (item) { return item.emergencyId !== alert.emergencyId; });
                        return __spreadArray(__spreadArray([], withoutCurrent, true), [alert], false).sort(function (a, b) {
                            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
                                b.emergencyId - a.emergencyId;
                        });
                    });
                    setActiveEmergencyModal(function (current) { return current !== null && current !== void 0 ? current : alert; });
                }
                else {
                    setEmergencyQueue(function (current) {
                        return current.filter(function (item) { return item.emergencyId !== alert.emergencyId; });
                    });
                    setActiveEmergencyModal(function (current) {
                        return (current === null || current === void 0 ? void 0 : current.emergencyId) === alert.emergencyId ? null : current;
                    });
                }
                void refreshDashboardData();
            }
        });
        return function () {
            closeStream();
        };
    }, [accessToken]);
    (0, react_1.useEffect)(function () {
        var appealsChannel = supabase_1.supabase
            .channel("admin-appeal-notifications")
            .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "violation_appeals"
        }, function () {
            void refreshDashboardData();
        })
            .subscribe();
        return function () {
            void supabase_1.supabase.removeChannel(appealsChannel);
        };
    }, [accessToken]);
    var handleEmergencyResponse = function (alert) { return __awaiter(_this, void 0, void 0, function () {
        var error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setEmergencyActionBusyId(alert.emergencyId);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, (0, emergencies_1.updateEmergencyAlertStatus)(accessToken, alert.emergencyId, "responding")];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, refreshDashboardData()];
                case 3:
                    _a.sent();
                    setActiveEmergencyModal(function (current) {
                        return (current === null || current === void 0 ? void 0 : current.emergencyId) === alert.emergencyId ? null : current;
                    });
                    setEmergencyQueue(function (current) {
                        return current.filter(function (item) { return item.emergencyId !== alert.emergencyId; });
                    });
                    return [3 /*break*/, 6];
                case 4:
                    error_3 = _a.sent();
                    setDashboardError(String(error_3));
                    return [3 /*break*/, 6];
                case 5:
                    setEmergencyActionBusyId(null);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var filteredNotificationItems = (0, react_1.useMemo)(function () {
        var recencyCutoff = getNotificationRecencyCutoff(notificationRecencyFilter, clockTs);
        var startTs = getDateFilterStartTs(notificationDateFrom);
        var endTs = getDateFilterEndTs(notificationDateTo);
        return notificationItems.filter(function (item) {
            if (notificationCategoryFilter !== "all" && item.kind !== notificationCategoryFilter) {
                return false;
            }
            if (notificationReadFilter === "unread" && item.isRead) {
                return false;
            }
            if (notificationReadFilter === "read" && !item.isRead) {
                return false;
            }
            if (recencyCutoff !== null && item.ts < recencyCutoff) {
                return false;
            }
            if (startTs !== null && item.ts < startTs) {
                return false;
            }
            if (endTs !== null && item.ts > endTs) {
                return false;
            }
            return true;
        });
    }, [
        notificationItems,
        notificationCategoryFilter,
        notificationReadFilter,
        notificationRecencyFilter,
        notificationDateFrom,
        notificationDateTo,
        clockTs
    ]);
    var hasNotificationFilters = notificationCategoryFilter !== "all" ||
        notificationReadFilter !== "all" ||
        notificationRecencyFilter !== "all" ||
        notificationDateFrom.length > 0 ||
        notificationDateTo.length > 0;
    var unreadNotificationCount = (0, react_1.useMemo)(function () {
        return notificationItems.filter(function (item) { return !item.isRead; }).length;
    }, [notificationItems]);
    var markNotificationAsRead = function (notificationKey) { return __awaiter(_this, void 0, void 0, function () {
        var target, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    target = notificationItems.find(function (item) { return item.key === notificationKey; });
                    if (!target || target.isRead)
                        return [2 /*return*/];
                    setDashboardData(function (current) {
                        return current
                            ? __assign(__assign({}, current), { notifications: current.notifications.map(function (item) {
                                    return item.notificationKey === notificationKey ? __assign(__assign({}, item), { isRead: true }) : item;
                                }), counts: __assign(__assign({}, current.counts), { unreadNotifications: Math.max(0, current.counts.unreadNotifications - 1) }) }) : current;
                    });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.all([
                            (0, dashboard_data_1.markDashboardNotificationsRead)(accessToken, [notificationKey]),
                            target.kind === "appeal"
                                ? (0, reports_1.markAdminAppealViewed)(accessToken, target.sourceEntityId)
                                : Promise.resolve()
                        ])];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _a = _b.sent();
                    void refreshDashboardData();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var filteredTripRows = (0, react_1.useMemo)(function () {
        if (!hasSearchQuery)
            return tripRows;
        return tripRows.filter(function (trip) {
            return textMatchesSearch(normalizedSearchQuery, trip.tripId, trip.driverId, trip.driverCode, trip.driverName, trip.tricycleId, trip.plateNo, trip.routeId, trip.routeName, trip.todaName, trip.barangayName, trip.tripStatus, trip.durationMinutes, trip.fareAmount, trip.distanceKm, trip.violationCount, trip.hasPath ? "has path" : "no saved path");
        });
    }, [tripRows, hasSearchQuery, normalizedSearchQuery]);
    var homeTripLogSummary = (0, react_1.useMemo)(function () {
        return filteredTripRows
            .filter(function (trip) { return trip.tripStatus === "completed"; })
            .sort(function (a, b) {
            var _a, _b;
            var aTs = new Date((_a = a.tripEnd) !== null && _a !== void 0 ? _a : a.tripStart).getTime();
            var bTs = new Date((_b = b.tripEnd) !== null && _b !== void 0 ? _b : b.tripStart).getTime();
            return bTs - aTs || b.tripId - a.tripId;
        })
            .slice(0, HOME_TRIP_LOG_SUMMARY_LIMIT);
    }, [filteredTripRows]);
    var tripLogStats = (0, react_1.useMemo)(function () {
        var ongoing = tripRows.filter(function (trip) { return trip.tripStatus === "ongoing"; }).length;
        var completed = tripRows.filter(function (trip) { return trip.tripStatus === "completed"; }).length;
        var cancelled = tripRows.filter(function (trip) { return trip.tripStatus === "cancelled"; }).length;
        return {
            total: tripRows.length,
            ongoing: ongoing,
            completed: completed,
            cancelled: cancelled
        };
    }, [tripRows]);
    var selectedDriverTripRows = (0, react_1.useMemo)(function () {
        if (!selectedDriver)
            return [];
        return tripRows
            .filter(function (trip) { return trip.driverId === selectedDriver.driverId; })
            .sort(function (a, b) {
            var _a, _b;
            var aTs = new Date((_a = a.tripEnd) !== null && _a !== void 0 ? _a : a.tripStart).getTime();
            var bTs = new Date((_b = b.tripEnd) !== null && _b !== void 0 ? _b : b.tripStart).getTime();
            return bTs - aTs;
        });
    }, [selectedDriver, tripRows]);
    var navItems = (0, react_1.useMemo)(function () {
        if (adminProfile.role === "superadmin") {
            return __spreadArray(__spreadArray([], BASE_NAV_ITEMS, true), [{ key: "superadmin", label: "Settings" }], false);
        }
        if (adminProfile.role === "toda_admin") {
            return TODA_NAV_ITEMS;
        }
        return BASE_NAV_ITEMS;
    }, [adminProfile.role]);
    var mainNavItems = navItems.filter(function (item) { return item.key !== "superadmin"; });
    var secondaryNavItems = navItems.filter(function (item) { return item.key === "superadmin"; });
    var pageLabel = (_c = (_b = navItems.find(function (item) { return item.key === activePage; })) === null || _b === void 0 ? void 0 : _b.label) !== null && _c !== void 0 ? _c : "Dashboard";
    var shouldLockPageScroll = activePage === "drivers" || activePage === "alerts" || activePage === "trip-logs";
    var headerScope = [adminProfile.barangayName, adminProfile.todaName]
        .filter(function (item) { return Boolean(item); })
        .join(" / ");
    var profileInitials = adminProfile.email
        .split("@")[0]
        .split(/[._-]/)
        .filter(Boolean)
        .slice(0, 2)
        .map(function (part) { var _a, _b; return (_b = (_a = part[0]) === null || _a === void 0 ? void 0 : _a.toUpperCase()) !== null && _b !== void 0 ? _b : ""; })
        .join("") || "AD";
    var profileDisplayName = adminProfile.email
        .split("@")[0]
        .split(/[._-]/)
        .filter(Boolean)
        .map(function (part) { return part.charAt(0).toUpperCase() + part.slice(1); })
        .join(" ") || "Admin User";
    var profileScope = adminProfile.role === "superadmin"
        ? "System Admin"
        : adminProfile.todaName
            ? "".concat(adminProfile.role.replace("_", " "), " - ").concat(adminProfile.todaName)
            : adminProfile.barangayName
                ? "".concat(adminProfile.role.replace("_", " "), " - ").concat(adminProfile.barangayName)
                : adminProfile.role.replace("_", " ");
    var dashboardStateLabel = !online
        ? dashboardData
            ? "Offline snapshot"
            : "Offline"
        : dashboardDataSource === "cache"
            ? "Cached snapshot"
            : syncStatus === "connected"
                ? "Live sync"
                : "Syncing";
    var dashboardStateTone = !online
        ? "offline"
        : dashboardDataSource === "cache"
            ? "cached"
            : syncStatus === "connected"
                ? "live"
                : "pending";
    var dashboardSyncSummary = lastDashboardSyncAt
        ? "Last synced ".concat(formatDateTime(lastDashboardSyncAt))
        : "Waiting for first sync";
    var pageSearchPlaceholder = childSearchPlaceholder !== null && childSearchPlaceholder !== void 0 ? childSearchPlaceholder : PAGE_SEARCH_PLACEHOLDERS[activePage];
    var openDriverModal = function (driver) {
        setSelectedDriverId(driver.driverId);
        setDriverTripHistoryOpen(false);
    };
    var closeDriverModal = function () {
        setSelectedDriverId(null);
        setDriverTripHistoryOpen(false);
    };
    var openTripPathModal = function (trip) {
        setSelectedTripForPath(trip);
    };
    var closeTripPathModal = function () {
        setSelectedTripForPath(null);
    };
    var activeViolationCoordinates = activeViolationAlert
        ? formatViolationCoordinates(activeViolationAlert)
        : undefined;
    var activeViolationDriverLabel = (_e = (_d = activeViolationAlert === null || activeViolationAlert === void 0 ? void 0 : activeViolationAlert.driverName) !== null && _d !== void 0 ? _d : activeViolationAlert === null || activeViolationAlert === void 0 ? void 0 : activeViolationAlert.driverCode) !== null && _e !== void 0 ? _e : "Unknown driver";
    var activeViolationInitials = activeViolationDriverLabel
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(function (part) { return part.charAt(0).toUpperCase(); })
        .join("") || "D";
    return (<div className="admin-shell">
      <aside className="admin-sidebar">
        <button type="button" className="sidebar-brand" onClick={function () { return setActivePage("home"); }} aria-label="Go to homepage">
          <img src="/triketrack_logo3.png" alt="TrikeTrack logo" className="sidebar-brand__logo"/>
          <div className="sidebar-brand__copy">
            <strong>TrikeTrack</strong>
            <span>TODA Monitoring</span>
          </div>
        </button>

        <div className="sidebar-section">
          <div className="sidebar-nav__label">Main</div>
          <nav className="sidebar-nav">
            {mainNavItems.map(function (item) { return (<button key={item.key} type="button" className={"sidebar-nav__item ".concat(item.key === activePage ? "sidebar-nav__item--active" : "")} onClick={function () { return setActivePage(item.key); }}>
                <span className="sidebar-nav__item-icon">{renderNavIcon(item.key)}</span>
                <span className="sidebar-nav__item-label">{item.label}</span>
                <span className="sidebar-nav__item-chevron" aria-hidden="true">
                  ›
                </span>
              </button>); })}
          </nav>
        </div>

        <div className="sidebar-section sidebar-section--footer">
          <div className="sidebar-nav__label">Others</div>
          {secondaryNavItems.length > 0 && (<nav className="sidebar-nav">
              {secondaryNavItems.map(function (item) { return (<button key={item.key} type="button" className={"sidebar-nav__item ".concat(item.key === activePage ? "sidebar-nav__item--active" : "")} onClick={function () { return setActivePage(item.key); }}>
                  <span className="sidebar-nav__item-icon">{renderNavIcon(item.key)}</span>
                  <span className="sidebar-nav__item-label">{item.label}</span>
                  <span className="sidebar-nav__item-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>); })}
            </nav>)}

          <button type="button" className="logout-button sidebar-logout" onClick={onLogout}>
            <span className="sidebar-nav__item-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 17 15 12 10 7"/>
                <path d="M15 12H4"/>
                <path d="M20 20V4"/>
              </svg>
            </span>
            <span className="sidebar-nav__item-label">Log out</span>
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar__intro">
            <div className="admin-topbar__crumb">{pageLabel}</div>
            {headerScope && <div className="admin-topbar__sub">{headerScope}</div>}
          </div>

          <div className="admin-topbar__controls">
            <input className="topbar-search" placeholder={pageSearchPlaceholder} value={searchQuery} onChange={function (event) { return setSearchQuery(event.target.value); }} aria-label={pageSearchPlaceholder.replace("...", "")}/>
            {activePage !== "superadmin" && activePage !== "toda-admin" && (<div className="admin-topbar__status" aria-live="polite">
                <span className={"admin-topbar__status-pill admin-topbar__status-pill--".concat(dashboardStateTone)}>
                  {dashboardStateLabel}
                </span>
                <span className="admin-topbar__status-text">{dashboardSyncSummary}</span>
              </div>)}
            <div className="topbar-notifications" ref={notificationPanelRef}>
              <button type="button" className={"topbar-notification-button ".concat(notificationsOpen ? "topbar-notification-button--active" : "")} aria-haspopup="dialog" aria-expanded={notificationsOpen} aria-label={unreadNotificationCount > 0
            ? "".concat(unreadNotificationCount, " unread notifications")
            : "Notifications"} onClick={function () { return setNotificationsOpen(function (current) { return !current; }); }}>
                <BellIcon />
                {unreadNotificationCount > 0 && (<span className="topbar-notification-badge">
                    {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                  </span>)}
              </button>

              {notificationsOpen && (<div className="topbar-notification-menu" role="dialog" aria-label="Notifications">
                  <div className="topbar-notification-menu__header">
                    <div>
                      <div className="topbar-notification-menu__title">Notifications</div>
                      <div className="topbar-notification-menu__subtitle">
                        Stored alerts, emergencies, appeals, trips, and driver updates shown newest first
                      </div>
                    </div>
                    <div className="topbar-notification-menu__actions">
                      <button type="button" className={"topbar-notification-refresh ".concat(isRefreshingNotifications
                ? "topbar-notification-refresh--spinning"
                : "")} onClick={function () { return void refreshNotificationsAndAlerts(); }} disabled={isRefreshingNotifications} aria-label="Refresh notifications and alerts" title="Refresh notifications and alerts">
                        <RefreshIcon />
                      </button>
                      <div className="topbar-notification-menu__count" aria-label={"".concat(unreadNotificationCount, " unread notifications")} title="Unread notifications">
                        {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                      </div>
                    </div>
                  </div>

                  <div className="topbar-notification-filters">
                    <div className="topbar-notification-filter-grid">
                      <select className="topbar-notification-filter" aria-label="Filter notifications by category" value={notificationCategoryFilter} onChange={function (event) {
                return setNotificationCategoryFilter(event.target.value);
            }}>
                        <option value="all">All categories</option>
                        <option value="violation">Alerts</option>
                        <option value="emergency">Emergencies</option>
                        <option value="appeal">Appeals</option>
                        <option value="trip">Trips</option>
                        <option value="driver">Drivers</option>
                      </select>

                      <select className="topbar-notification-filter" aria-label="Filter notifications by read status" value={notificationReadFilter} onChange={function (event) {
                return setNotificationReadFilter(event.target.value);
            }}>
                        <option value="all">Read and unread</option>
                        <option value="unread">Unread only</option>
                        <option value="read">Read only</option>
                      </select>

                      <select className="topbar-notification-filter" aria-label="Filter notifications by recency" value={notificationRecencyFilter} onChange={function (event) {
                return setNotificationRecencyFilter(event.target.value);
            }}>
                        <option value="all">All time</option>
                        <option value="24h">Last 24 hours</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                      </select>
                    </div>

                    <div className="topbar-notification-date-range">
                      <label className="topbar-notification-date-field">
                        <span>From</span>
                        <input type="date" value={notificationDateFrom} max={notificationDateTo || undefined} onChange={function (event) { return setNotificationDateFrom(event.target.value); }} aria-label="Filter notifications from date"/>
                      </label>

                      <label className="topbar-notification-date-field">
                        <span>To</span>
                        <input type="date" value={notificationDateTo} min={notificationDateFrom || undefined} onChange={function (event) { return setNotificationDateTo(event.target.value); }} aria-label="Filter notifications to date"/>
                      </label>
                    </div>

                    {hasNotificationFilters && (<button type="button" className="topbar-notification-clear" onClick={function () {
                    setNotificationCategoryFilter("all");
                    setNotificationReadFilter("all");
                    setNotificationRecencyFilter("all");
                    setNotificationDateFrom("");
                    setNotificationDateTo("");
                }}>
                        Clear filters
                      </button>)}
                  </div>

                  <div className="topbar-notification-list">
                    {filteredNotificationItems.length === 0 ? (<div className="topbar-notification-empty">
                        {notificationItems.length === 0
                    ? "No important notifications yet."
                    : "No notifications match the selected filters."}
                      </div>) : (filteredNotificationItems.map(function (item) { return (<button key={item.key} type="button" className={"topbar-notification-item ".concat(item.isRead
                    ? "topbar-notification-item--read"
                    : "topbar-notification-item--unread")} onClick={function () {
                    void markNotificationAsRead(item.key);
                    setActivePage(item.page);
                    setNotificationsOpen(false);
                }}>
                          <span className={"topbar-notification-item__icon topbar-notification-item__icon--".concat(item.tone)} aria-hidden="true">
                            {item.kind === "violation"
                    ? "!"
                    : item.kind === "emergency"
                        ? "E"
                        : item.kind === "appeal"
                            ? "A"
                            : item.kind === "trip"
                                ? "T"
                                : "D"}
                          </span>
                          <span className="topbar-notification-item__content">
                            <span className="topbar-notification-item__title">
                              {item.title}
                              {!item.isRead && (<span className="topbar-notification-item__state">Unread</span>)}
                              {item.isRead && (<span className="topbar-notification-item__state topbar-notification-item__state--read">
                                  Read
                                </span>)}
                            </span>
                            <span className="topbar-notification-item__body">{item.body}</span>
                          </span>
                          <span className="topbar-notification-item__time">
                            {formatRelativeTimestamp(item.ts, clockTs)}
                          </span>
                        </button>); }))}
                  </div>
                </div>)}
            </div>
            <button type="button" className="topbar-profile topbar-profile--button" onClick={function () { return setProfileModalOpen(true); }} aria-haspopup="dialog" aria-expanded={profileModalOpen} aria-label="Open admin profile settings">
              <div className="profile-avatar">{profileInitials}</div>
              <div>
                <div className="profile-name">{adminProfile.email}</div>
                <div className="profile-meta">{profileScope}</div>
              </div>
            </button>
          </div>
        </header>

        <main className={"admin-content ".concat(activePage === "live-map" ? "admin-content--live-map" : "", " ").concat(shouldLockPageScroll ? "admin-content--table-page" : "")}>
          {(dashboardNotice || dashboardError) &&
            activePage !== "superadmin" &&
            activePage !== "toda-admin" &&
            activePage !== "live-map" && (<div className={"page-panel dashboard-sync-banner".concat(dashboardError ? " dashboard-sync-banner--error" : "")} style={{ padding: "12px 14px", marginBottom: "14px" }}>
              <div className="muted">
                {dashboardError
                ? "Dashboard data sync issue: ".concat(dashboardError)
                : dashboardNotice}
              </div>
            </div>)}

          {activePage === "superadmin" && adminProfile.role === "superadmin" && (<SuperadminPage_1.default accessToken={accessToken} mode="superadmin" searchQuery={searchQuery} onSearchPlaceholderChange={setChildSearchPlaceholder} onDataChanged={function () { return void refreshDashboardData(); }}/>)}

          {activePage === "toda-admin" && adminProfile.role === "toda_admin" && (<SuperadminPage_1.default accessToken={accessToken} mode="toda-admin" lockedTodaId={adminProfile.todaId} lockedTodaLabel={adminProfile.todaName} searchQuery={searchQuery} onSearchPlaceholderChange={setChildSearchPlaceholder} onDataChanged={function () { return void refreshDashboardData(); }}/>)}

          {activePage === "home" && (<section className="page-stack">
              <div className="overview-grid">
                <article className="overview-card">
                  <div className="overview-card__label">Active Drivers</div>
                  <div className="overview-card__value">{activeDriverCount}</div>
                </article>

                <article className="overview-card">
                  <div className="overview-card__label">Active Alerts</div>
                  <div className="overview-card__value overview-card__value--danger">
                    {((_f = dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.counts.openAlerts) !== null && _f !== void 0 ? _f : alertRows.length).toString().padStart(2, "0")}
                  </div>
                </article>

                <article className="overview-card">
                  <div className="overview-card__label">Total Trips Today</div>
                  <div className="overview-card__value">{totalTripsToday.toLocaleString()}</div>
                </article>

                <article className="overview-card">
                  <div className="overview-card__label">Ongoing Trips</div>
                  <div className="overview-card__value">{(_g = dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.counts.ongoingTrips) !== null && _g !== void 0 ? _g : 0}</div>
                </article>
              </div>

              <section className="home-summary-grid">
                <section className="page-panel">
                  <div className="page-panel__header page-panel__header--compact">
                    <div>
                      <h3>Alerts Highlights</h3>
                      <p>View alert details in the Alerts page.</p>
                    </div>
                    <button type="button" className="summary-link" onClick={function () { return setActivePage("alerts"); }}>
                      View all
                    </button>
                  </div>
                  <div className="alerts-list alerts-list--summary">
                    {homeAlertSummary.length === 0 ? (<div className="muted">
                        {hasSearchQuery
                    ? "No alerts match \"".concat(trimmedSearchQuery, "\".")
                    : "No alerts or emergencies yet."}
                      </div>) : (homeAlertSummary.map(function (alert) {
                var _a;
                return (<div key={alert.key} className="alert-row">
                          <div className="alert-row__top">
                            <strong>{(_a = alert.driverName) !== null && _a !== void 0 ? _a : "Driver ".concat(alert.driverId)}</strong>
                            <span>{new Date(alert.ts).toLocaleTimeString()}</span>
                          </div>
                          <div className="alert-row__meta">{alert.reason}</div>
                          {alert.description && (<div className="alert-row__meta">{alert.description}</div>)}
                          {alert.lat !== undefined && alert.lng !== undefined && (<div className="alert-row__meta">
                              {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}
                            </div>)}
                        </div>);
            }))}
                  </div>
                </section>

                <section className="page-panel">
                  <div className="page-panel__header page-panel__header--compact">
                    <div>
                      <h3>Trip Logs Summary</h3>
                      <p>View all trips in the Trip Logs page.</p>
                    </div>
                    <button type="button" className="summary-link" onClick={function () { return setActivePage("trip-logs"); }}>
                      View all
                    </button>
                  </div>
                  <div className="trip-logs-list trip-logs-list--summary">
                    {homeTripLogSummary.length === 0 ? (<div className="muted">
                        {hasSearchQuery
                    ? "No trip logs match \"".concat(trimmedSearchQuery, "\".")
                    : "No trip records are available yet."}
                      </div>) : (homeTripLogSummary.map(function (item) {
                return (<div key={"trip-".concat(item.tripId)} className="trip-driver">
                            <div className="trip-driver__top">
                              <strong>{item.driverName}</strong>
                              <span>{item.tripStatus.toUpperCase()}</span>
                            </div>
                            <div className="trip-driver__meta">
                              Trip #{item.tripId} | {item.plateNo} | {item.routeName}
                            </div>
                          </div>);
            }))}
                  </div>
                </section>
              </section>
            </section>)}

          <section className={"live-map-grid ".concat(showLiveMapView ? "" : "page-hidden", " ").concat(activePage === "home" ? "live-map-grid--home" : "", " ").concat(activePage === "live-map" ? "live-map-grid--live" : "")}>
            <section className="page-panel page-panel--map">
              <div className="admin-map" ref={mapEl}/>
              {showViolatorOverlay && (<ViolatorProfileStack_1.default violators={activeViolators} selectedDriverKey={selectedViolatorKey} onSelect={handleViolatorSelect} onDismiss={dismissViolatorProfile}/>)}
              {showViolatorOverlay && selectedViolator && selectedViolationPopupPosition && (<ViolationPopup_1.default violator={selectedViolator} position={selectedViolationPopupPosition} onClose={function () { return setSelectedViolatorKey(null); }}/>)}
            </section>

            {activePage !== "live-map" ? (<aside className="live-map-side">
                <section className="page-panel side-card">
                  <div className="admin-pane__title">Sync Status</div>
                  <div className="meta-grid">
                    <div>Network</div>
                    <div>{online ? "Online" : "Offline"}</div>
                    <div>Data source</div>
                    <div>{dashboardStateLabel}</div>
                    <div>Realtime</div>
                    <div>{syncStatus}</div>
                    <div>Active Drivers</div>
                    <div>{activeDriverCount}</div>
                    <div>Active Tricycles</div>
                    <div>{activeTricycleCount}</div>
                    <div>Ongoing trips</div>
                    <div>{(_h = dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.counts.ongoingTrips) !== null && _h !== void 0 ? _h : 0}</div>
                    <div>Open alerts</div>
                    <div>{(_j = dashboardData === null || dashboardData === void 0 ? void 0 : dashboardData.counts.openAlerts) !== null && _j !== void 0 ? _j : alertRows.length}</div>
                    <div>Last data update</div>
                    <div>{lastUpdateTs ? new Date(lastUpdateTs).toLocaleTimeString() : "-"}</div>
                    <div>Last sync</div>
                    <div>{lastDashboardSyncAt ? formatDateTime(lastDashboardSyncAt) : "-"}</div>
                  </div>
                </section>

                <section className="page-panel side-card">
                  <div className="admin-pane__title">Drivers</div>
                  <div className="drivers-list">
                    {filteredActiveDriverRows.length === 0 ? (<div className="muted">
                        {hasSearchQuery
                    ? "No drivers match \"".concat(trimmedSearchQuery, "\".")
                    : "No active drivers yet."}
                      </div>) : (filteredActiveDriverRows.slice(0, 8).map(function (driver) {
                var _a;
                var presence = getDriverPresenceMeta(driver, clockTs, livePresenceHydrated);
                return (<div className="driver-row driver-row--interactive" key={driver.driverId} role="button" tabIndex={0} onClick={function () { return openDriverModal(driver); }} onKeyDown={function (event) {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openDriverModal(driver);
                        }
                    }}>
                            <div className="driver-row__top driver-row__top--profile">
                              <div className="driver-row__identity">
                                {driver.avatarUrl ? (<img className="driver-row__avatar" src={driver.avatarUrl} alt={"".concat(driver.firstName, " ").concat(driver.lastName)}/>) : (<div className="driver-row__avatar driver-row__avatar--fallback" aria-hidden="true">
                                    {"".concat(driver.firstName.charAt(0)).concat(driver.lastName.charAt(0))
                            .toUpperCase()
                            .slice(0, 2)}
                                  </div>)}
                                <strong>{driver.firstName} {driver.lastName}</strong>
                              </div>
                              <span className={presence.className}>{presence.label}</span>
                            </div>
                            <div className="driver-row__meta">
                              {driver.driverCode} | {driver.todaName}
                            </div>
                            <div className="driver-row__meta">
                              {driver.tricycleNo
                        ? "Tricycle ".concat(driver.tricycleNo)
                        : "No tricycle assigned"}
                              {driver.qrId ? " | QR #".concat(driver.qrId) : ""}
                            </div>
                            <div className="driver-row__meta">
                              {driver.liveState
                        ? "Point ".concat(formatPoint(driver.liveState.latestPoint))
                        : ((_a = driver.operationalState) === null || _a === void 0 ? void 0 : _a.activeRouteName)
                            ? "Route ".concat(driver.operationalState.activeRouteName)
                            : "Waiting for live GPS point"}
                            </div>
                          </div>);
            }))}
                  </div>
                </section>
              </aside>) : null}
          </section>

          {activePage === "drivers" && (adminProfile.role === "toda_admin" ? (<TodaManagementPage_1.default accessToken={accessToken} page="drivers" lockedTodaId={adminProfile.todaId} lockedTodaLabel={adminProfile.todaName} searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} onDriverDeleted={function (driver) {
                return purgeViolatorProfilesByTokens(buildDriverTokens(driver.driverCode, driver.driverId));
            }} onDataChanged={function () { return void refreshDashboardData(); }}/>) : (<section className="page-panel page-panel--table-layout">
                <div className="drivers-table-summary">
                  <article className="drivers-table-summary__card">
                    <span>Total Drivers</span>
                    <strong>{systemDriverStats.total}</strong>
                  </article>
                  <article className="drivers-table-summary__card">
                    <span>Active Drivers</span>
                    <strong>{systemDriverStats.active}</strong>
                  </article>
                  <article className="drivers-table-summary__card">
                    <span>In Transit</span>
                    <strong>{systemDriverStats.inTransit}</strong>
                  </article>
                  <article className="drivers-table-summary__card">
                    <span>Idle Drivers</span>
                    <strong>{systemDriverStats.idle}</strong>
                  </article>
                  <article className="drivers-table-summary__card">
                    <span>Setup Pending</span>
                    <strong>{systemDriverStats.setupPending}</strong>
                  </article>
                </div>
                <div className="drivers-table-shell">
                  {filteredAllDriverRows.length === 0 ? (<div className="drivers-table-empty">
                      {hasSearchQuery ? "No drivers match \"".concat(trimmedSearchQuery, "\".") : "No drivers yet."}
                    </div>) : (<div className="drivers-table-wrap">
                      <table className="drivers-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Driver ID</th>
                            <th>Vehicle</th>
                            <th>QR</th>
                            <th>Barangay / TODA</th>
                            <th>Route / Point</th>
                            <th>Last Update</th>
                            <th>Password</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAllDriverRows.map(function (driver) {
                    var _a, _b, _c;
                    var presence = getDriverPresenceMeta(driver, clockTs, livePresenceHydrated);
                    return (<tr key={driver.driverId} className="drivers-table__row" role="button" tabIndex={0} onClick={function () { return openDriverModal(driver); }} onKeyDown={function (event) {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openDriverModal(driver);
                            }
                        }} aria-label={"View details for ".concat(driver.firstName, " ").concat(driver.lastName)}>
                                <td>
                                  <div className="drivers-table__identity">
                                    {driver.avatarUrl ? (<img className="drivers-table__avatar" src={driver.avatarUrl} alt={"".concat(driver.firstName, " ").concat(driver.lastName)}/>) : (<div className="drivers-table__avatar drivers-table__avatar--fallback" aria-hidden="true">
                                        {"".concat(driver.firstName.charAt(0)).concat(driver.lastName.charAt(0))
                                .toUpperCase()
                                .slice(0, 2)}
                                      </div>)}
                                    <div className="drivers-table__identity-text">
                                      <strong>{driver.firstName} {driver.lastName}</strong>
                                      <span>{(_a = driver.contactNo) !== null && _a !== void 0 ? _a : "No contact provided"}</span>
                                    </div>
                                  </div>
                                </td>
                                <td>{driver.driverCode}</td>
                                <td>{driver.tricycleNo ? "Tricycle ".concat(driver.tricycleNo) : "Unassigned"}</td>
                                <td>{driver.qrId ? "#".concat(driver.qrId) : "Not assigned"}</td>
                                <td>
                                  <div className="drivers-table__stack">
                                    <strong>{driver.barangayName}</strong>
                                    <span>{driver.todaName}</span>
                                  </div>
                                </td>
                                <td>
                                  <div className="drivers-table__stack">
                                    <strong>
                                      {((_b = driver.operationalState) === null || _b === void 0 ? void 0 : _b.activeRouteName)
                            ? "Route ".concat(driver.operationalState.activeRouteName)
                            : "No active route"}
                                    </strong>
                                    <span>
                                      {driver.liveState
                            ? formatPoint(driver.liveState.latestPoint)
                            : "Waiting for live GPS point"}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  {driver.liveState
                            ? formatLastSeen(driver.liveState.lastSeenTs, clockTs)
                            : ((_c = driver.operationalState) === null || _c === void 0 ? void 0 : _c.lastUpdateAt)
                                ? formatDateTime(driver.operationalState.lastUpdateAt)
                                : "No live point yet"}
                                </td>
                                <td>
                                  <span className="drivers-table__pill">
                                    {driver.passwordSet ? "Set" : "Pending"}
                                  </span>
                                </td>
                                <td>
                                  <span className={presence.className}>{presence.label}</span>
                                </td>
                              </tr>);
                })}
                        </tbody>
                      </table>
                    </div>)}
                </div>
              </section>))}

          {selectedDriver && !driverTripHistoryOpen && (<div className="driver-modal-backdrop" role="presentation" onClick={closeDriverModal}>
              <div className="driver-modal" role="dialog" aria-modal="true" aria-labelledby="driver-modal-title" onClick={function (event) { return event.stopPropagation(); }}>
                <div className="driver-modal__header">
                  <div className="driver-modal__profile">
                    {selectedDriver.avatarUrl ? (<img className="driver-modal__avatar" src={selectedDriver.avatarUrl} alt={"".concat(selectedDriver.firstName, " ").concat(selectedDriver.lastName)}/>) : (<div className="driver-modal__avatar driver-modal__avatar--fallback" aria-hidden="true">
                        {"".concat(selectedDriver.firstName.charAt(0)).concat(selectedDriver.lastName.charAt(0))
                    .toUpperCase()
                    .slice(0, 2)}
                      </div>)}
                    <div>
                      <h3 id="driver-modal-title">
                        {selectedDriver.firstName} {selectedDriver.lastName}
                      </h3>
                      <p>{selectedDriver.driverCode}</p>
                    </div>
                  </div>
                  <div className="driver-modal__header-actions">
                    <button type="button" className="driver-modal__primary" onClick={function () { return setDriverTripHistoryOpen(true); }}>
                      Trip History
                    </button>
                    <button type="button" className="driver-modal__close" onClick={closeDriverModal}>
                      Close
                    </button>
                  </div>
                </div>

                <div className="driver-modal__body">
                  <section className="driver-modal__contact-strip" aria-label="Driver quick details">
                    <div>
                      <span className="driver-modal__label">Contact</span>
                      <strong>{(_k = selectedDriver.contactNo) !== null && _k !== void 0 ? _k : "No contact provided"}</strong>
                    </div>
                    <div>
                      <span className="driver-modal__label">Barangay</span>
                      <strong>{selectedDriver.barangayName}</strong>
                    </div>
                    <div>
                      <span className="driver-modal__label">TODA</span>
                      <strong>{selectedDriver.todaName}</strong>
                    </div>
                    <div>
                      <span className="driver-modal__label">Last Active</span>
                      <strong>
                        {selectedDriver.liveState
                ? formatLastSeen(selectedDriver.liveState.lastSeenTs, clockTs)
                : "No live point yet"}
                      </strong>
                    </div>
                  </section>

                  <section className="driver-modal__section">
                    <div className="driver-modal__section-head">
                      <h4>General Information</h4>
                    </div>
                    <div className="driver-modal__info-grid">
                      <div>
                        <span className="driver-modal__label">Driver Status</span>
                        <strong>
                          {getDriverPresenceMeta(selectedDriver, clockTs, livePresenceHydrated).label}
                        </strong>
                      </div>
                      <div>
                        <span className="driver-modal__label">Password</span>
                        <strong>{selectedDriver.passwordSet ? "Set" : "Pending"}</strong>
                      </div>
                      <div>
                        <span className="driver-modal__label">Created</span>
                        <strong>{formatDateTime(selectedDriver.createdAt)}</strong>
                      </div>
                      <div>
                        <span className="driver-modal__label">Recent Trips</span>
                        <strong>{selectedDriverTripRows.length}</strong>
                      </div>
                    </div>
                  </section>

                  <section className="driver-modal__section">
                    <div className="driver-modal__section-head">
                      <h4>Assignment Information</h4>
                    </div>
                    <div className="driver-modal__info-grid">
                      <div>
                        <span className="driver-modal__label">Assigned Tricycle</span>
                        <strong>
                          {selectedDriver.tricycleNo
                ? "Tricycle ".concat(selectedDriver.tricycleNo)
                : "No tricycle assigned"}
                        </strong>
                      </div>
                      <div>
                        <span className="driver-modal__label">QR</span>
                        <strong>{selectedDriver.qrId ? "#".concat(selectedDriver.qrId) : "Not assigned"}</strong>
                      </div>
                      <div>
                        <span className="driver-modal__label">Current Route / Point</span>
                        <strong>
                          {selectedDriver.liveState
                ? formatPoint(selectedDriver.liveState.latestPoint)
                : ((_l = selectedDriver.operationalState) === null || _l === void 0 ? void 0 : _l.activeRouteName)
                    ? "Route ".concat(selectedDriver.operationalState.activeRouteName)
                    : "Waiting for live GPS point"}
                        </strong>
                      </div>
                      <div>
                        <span className="driver-modal__label">Operational State</span>
                        <strong>
                          {((_m = selectedDriver.operationalState) === null || _m === void 0 ? void 0 : _m.operationalStatus)
                ? selectedDriver.operationalState.operationalStatus.replace("_", " ")
                : "No active operation"}
                        </strong>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>)}

          {selectedDriver && driverTripHistoryOpen && (<div className="driver-modal-backdrop driver-modal-backdrop--stacked" role="presentation">
              <div className="driver-modal driver-modal--history" role="dialog" aria-modal="true" aria-labelledby="driver-trip-history-title" onClick={function (event) { return event.stopPropagation(); }}>
                <div className="driver-modal__header">
                  <div>
                    <h3 id="driver-trip-history-title">Trip History</h3>
                    <p>
                      {selectedDriver.firstName} {selectedDriver.lastName} | {selectedDriver.driverCode}
                    </p>
                  </div>
                  <div className="driver-modal__header-actions">
                    <button type="button" className="driver-modal__secondary" onClick={function () { return setDriverTripHistoryOpen(false); }}>
                      Back
                    </button>
                    <button type="button" className="driver-modal__close" onClick={closeDriverModal}>
                      Close
                    </button>
                  </div>
                </div>
                <div className="driver-modal__body">
                  <section className="driver-modal__section">
                    <div className="driver-modal__section-head">
                      <h4>Recent Trips</h4>
                      <p>Showing recent trips available in the dashboard.</p>
                    </div>

                    {selectedDriverTripRows.length === 0 ? (<div className="driver-modal__empty">
                        No trip history found for this driver yet.
                      </div>) : (<div className="driver-trip-list">
                        {selectedDriverTripRows.map(function (trip) { return (<article key={trip.tripId} className="driver-trip-card">
                            <div className="driver-trip-card__top">
                              <div>
                                <strong>{trip.routeName}</strong>
                                <div className="driver-trip-card__meta">
                                  Trip #{trip.tripId} | {trip.plateNo} | {trip.todaName}
                                </div>
                              </div>
                              <span className={"driver-trip-card__status driver-trip-card__status--".concat(trip.tripStatus)}>
                                {formatTripStatus(trip.tripStatus)}
                              </span>
                            </div>
                            <div className="driver-trip-card__grid">
                              <div>
                                <span>Start</span>
                                <strong>{formatDateTime(trip.tripStart)}</strong>
                              </div>
                              <div>
                                <span>End</span>
                                <strong>{formatDateTime(trip.tripEnd)}</strong>
                              </div>
                              <div>
                                <span>Duration</span>
                                <strong>{trip.durationMinutes !== undefined ? "".concat(trip.durationMinutes, " min") : "-"}</strong>
                              </div>
                              <div>
                                <span>Distance</span>
                                <strong>{trip.distanceKm !== undefined ? "".concat(trip.distanceKm.toFixed(2), " km") : "-"}</strong>
                              </div>
                              <div>
                                <span>Fare</span>
                                <strong>{trip.fareAmount !== undefined ? "PHP ".concat(trip.fareAmount.toFixed(2)) : "-"}</strong>
                              </div>
                              <div>
                                <span>Alerts</span>
                                <strong>{trip.violationCount}</strong>
                              </div>
                            </div>
                            <button type="button" className="trip-path-button" onClick={function () { return openTripPathModal(trip); }} disabled={!trip.hasPath}>
                              {trip.hasPath ? "View Trip Path" : "No saved path"}
                            </button>
                          </article>); })}
                      </div>)}
                  </section>
                </div>
              </div>
            </div>)}

          {profileModalOpen && (<div className="profile-settings-backdrop" role="presentation" onClick={function () { return setProfileModalOpen(false); }}>
              <div className="profile-settings-modal" role="dialog" aria-modal="true" aria-labelledby="profile-settings-title" onClick={function (event) { return event.stopPropagation(); }}>
                <div className="profile-settings-modal__header">
                  <div className="profile-settings-modal__identity">
                    <div className="profile-settings-modal__avatar">{profileInitials}</div>
                    <div>
                      <h3 id="profile-settings-title">Admin Profile Settings</h3>
                      <p>{profileDisplayName}</p>
                    </div>
                  </div>
                  <button type="button" className="profile-settings-modal__close" onClick={function () { return setProfileModalOpen(false); }}>
                    Close
                  </button>
                </div>

                <form className="profile-settings-modal__form">
                  <label className="profile-settings-modal__field">
                    <span>Email Address</span>
                    <input type="email" value={adminProfile.email} readOnly/>
                  </label>

                  <label className="profile-settings-modal__field">
                    <span>Role</span>
                    <input type="text" value={profileScope} readOnly/>
                  </label>

                  <label className="profile-settings-modal__field">
                    <span>Status</span>
                    <input type="text" value={adminProfile.status.charAt(0).toUpperCase() + adminProfile.status.slice(1)} readOnly/>
                  </label>

                  <label className="profile-settings-modal__field">
                    <span>Barangay</span>
                    <input type="text" value={(_o = adminProfile.barangayName) !== null && _o !== void 0 ? _o : "All barangays"} readOnly/>
                  </label>

                  <label className="profile-settings-modal__field">
                    <span>TODA</span>
                    <input type="text" value={(_p = adminProfile.todaName) !== null && _p !== void 0 ? _p : "All TODAs"} readOnly/>
                  </label>

                  <label className="profile-settings-modal__field">
                    <span>City</span>
                    <input type="text" value={(_q = adminProfile.city) !== null && _q !== void 0 ? _q : "Not assigned"} readOnly/>
                  </label>

                  <label className="profile-settings-modal__field">
                    <span>Admin ID</span>
                    <input type="text" value={"ADM-".concat(String(adminProfile.adminId).padStart(3, "0"))} readOnly/>
                  </label>

                  <label className="profile-settings-modal__field profile-settings-modal__field--wide">
                    <span>Account Note</span>
                    <textarea rows={3} value="Profile updates are currently managed through the centralized admin account records." readOnly/>
                  </label>
                </form>

                <div className="profile-settings-modal__footer">
                  <button type="button" className="profile-settings-modal__secondary" onClick={function () { return setProfileModalOpen(false); }}>
                    Done
                  </button>
                  <button type="button" className="profile-settings-modal__danger" onClick={onLogout}>
                    Log out
                  </button>
                </div>
              </div>
            </div>)}

          {activePage === "tricycles" && adminProfile.role === "toda_admin" && (<TodaManagementPage_1.default accessToken={accessToken} page="tricycles" lockedTodaId={adminProfile.todaId} lockedTodaLabel={adminProfile.todaName} searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} onDataChanged={function () { return void refreshDashboardData(); }}/>)}

          {activePage === "alerts" && (<section className="page-panel page-panel--table-layout">
              <div className="dashboard-table-summary">
                <article className="dashboard-table-summary__card">
                  <span>Total Alerts</span>
                  <strong>{alertStats.total}</strong>
                </article>
                <article className="dashboard-table-summary__card">
                  <span>Open Alerts</span>
                  <strong>{alertStats.open}</strong>
                </article>
                <article className="dashboard-table-summary__card">
                  <span>Emergencies</span>
                  <strong>{alertStats.emergency}</strong>
                </article>
                <article className="dashboard-table-summary__card">
                  <span>Resolved</span>
                  <strong>{alertStats.resolved}</strong>
                </article>
              </div>
              <div className="dashboard-table-shell">
                {filteredAlerts.length === 0 ? (<div className="dashboard-table-empty">
                    {hasSearchQuery
                    ? "No alerts match \"".concat(trimmedSearchQuery, "\".")
                    : "No alerts or emergencies yet."}
                  </div>) : (<div className="dashboard-table-wrap">
                    <table className="dashboard-data-table">
                      <thead>
                        <tr>
                          <th>Driver</th>
                          <th>Type</th>
                          <th>Reason</th>
                          <th>Plate / Route</th>
                          <th>Location</th>
                          <th>Scope</th>
                          <th>Time</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAlerts.map(function (alert) {
                    var _a, _b, _c;
                    return (<tr key={alert.key}>
                            <td>{(_a = alert.driverName) !== null && _a !== void 0 ? _a : "Driver ".concat(alert.driverId)}</td>
                            <td>{alert.source === "emergency" ? "Emergency" : "Alert"}</td>
                            <td>{alert.reason}</td>
                            <td>{[alert.plateNo, alert.routeName].filter(Boolean).join(" / ") || "-"}</td>
                            <td>
                              {alert.lat !== undefined && alert.lng !== undefined
                            ? "".concat(alert.lat.toFixed(5), ", ").concat(alert.lng.toFixed(5))
                            : (_b = alert.description) !== null && _b !== void 0 ? _b : "-"}
                            </td>
                            <td>{[alert.barangayName, alert.todaName].filter(Boolean).join(" / ") || "-"}</td>
                            <td>{new Date(alert.ts).toLocaleString()}</td>
                            <td>
                              <span className={"drivers-table__pill drivers-table__pill--status"}>
                                {(_c = alert.status) !== null && _c !== void 0 ? _c : (alert.source === "emergency" ? "created" : "open")}
                              </span>
                            </td>
                          </tr>);
                })}
                      </tbody>
                    </table>
                  </div>)}
              </div>
            </section>)}

          {activePage === "reports" && (<ReportsPage_1.default accessToken={accessToken} initialSection={reportsPageSection} searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} onSearchPlaceholderChange={setChildSearchPlaceholder} onDataChanged={function () { return void refreshDashboardData(); }}/>)}

          {activePage === "trip-logs" && (<section className="page-panel page-panel--table-layout">
              <div className="dashboard-table-summary">
                <article className="dashboard-table-summary__card">
                  <span>Total Trips</span>
                  <strong>{tripLogStats.total}</strong>
                </article>
                <article className="dashboard-table-summary__card">
                  <span>Ongoing</span>
                  <strong>{tripLogStats.ongoing}</strong>
                </article>
                <article className="dashboard-table-summary__card">
                  <span>Completed</span>
                  <strong>{tripLogStats.completed}</strong>
                </article>
                <article className="dashboard-table-summary__card">
                  <span>Cancelled</span>
                  <strong>{tripLogStats.cancelled}</strong>
                </article>
              </div>
              <div className="dashboard-table-shell">
                {filteredTripRows.length === 0 ? (<div className="dashboard-table-empty">
                    {hasSearchQuery
                    ? "No trip logs match \"".concat(trimmedSearchQuery, "\".")
                    : "No stored trips yet."}
                  </div>) : (<div className="dashboard-table-wrap">
                    <table className="dashboard-data-table">
                      <thead>
                        <tr>
                          <th>Trip</th>
                          <th>Driver</th>
                          <th>Plate</th>
                          <th>Route</th>
                          <th>Start</th>
                          <th>End</th>
                          <th>Fare</th>
                          <th>Duration</th>
                          <th>Distance</th>
                          <th>Path</th>
                          <th>Alerts</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTripRows.map(function (trip) {
                    var _a;
                    return (<tr key={trip.tripId}>
                            <td>{trip.tripId}</td>
                            <td>{trip.driverName}</td>
                            <td>{trip.plateNo}</td>
                            <td>{trip.routeName}</td>
                            <td>{new Date(trip.tripStart).toLocaleString()}</td>
                            <td>{trip.tripEnd ? new Date(trip.tripEnd).toLocaleString() : "-"}</td>
                            <td>{trip.fareAmount !== undefined ? "PHP ".concat(trip.fareAmount.toFixed(2)) : "-"}</td>
                            <td>{trip.durationMinutes !== undefined ? "".concat(trip.durationMinutes, " min") : "-"}</td>
                            <td>{trip.distanceKm !== undefined ? "".concat(trip.distanceKm.toFixed(2), " km") : "-"}</td>
                            <td>
                              <button type="button" className="table-action-button" onClick={function () { return openTripPathModal(trip); }} disabled={!trip.hasPath}>
                                {trip.hasPath ? "".concat((_a = trip.pathPointCount) !== null && _a !== void 0 ? _a : 0, " pts") : "None"}
                              </button>
                            </td>
                            <td>{trip.violationCount}</td>
                            <td>
                              <span className="drivers-table__pill drivers-table__pill--status">
                                {trip.tripStatus}
                              </span>
                            </td>
                          </tr>);
                })}
                      </tbody>
                    </table>
                  </div>)}
              </div>
            </section>)}
        </main>
        {selectedTripForPath && (<div className="trip-path-modal-backdrop" role="presentation" onClick={closeTripPathModal}>
            <section className="trip-path-modal" role="dialog" aria-modal="true" aria-labelledby="trip-path-modal-title" onClick={function (event) { return event.stopPropagation(); }}>
              <div className="trip-path-modal__header">
                <div>
                  <h2 id="trip-path-modal-title">
                    Trip #{selectedTripForPath.tripId} Path
                  </h2>
                  <p>
                    {selectedTripForPath.driverName} | {selectedTripForPath.plateNo} |{" "}
                    {selectedTripForPath.routeName}
                  </p>
                </div>
                <button type="button" className="trip-path-modal__close" onClick={closeTripPathModal}>
                  Close
                </button>
              </div>

              <div className="trip-path-modal__body">
                <div className="trip-path-modal__meta">
                  <div>
                    <span>Start</span>
                    <strong>{formatDateTime(selectedTripForPath.tripStart)}</strong>
                  </div>
                  <div>
                    <span>End</span>
                    <strong>{formatDateTime(selectedTripForPath.tripEnd)}</strong>
                  </div>
                  <div>
                    <span>Points</span>
                    <strong>{(_s = (_r = tripPathData === null || tripPathData === void 0 ? void 0 : tripPathData.pointCount) !== null && _r !== void 0 ? _r : selectedTripForPath.pathPointCount) !== null && _s !== void 0 ? _s : "-"}</strong>
                  </div>
                  <div>
                    <span>Alerts</span>
                    <strong>{selectedTripForPath.violationCount}</strong>
                  </div>
                </div>

                {tripPathError && (<div className="trip-path-modal__notice" role="status">
                    {tripPathError.replace(/^Error:\s*/, "")}
                  </div>)}

                {tripPathLoading ? (<div className="trip-path-modal__empty">Loading saved trip path...</div>) : tripPathData ? (<TripPathMap tripPath={tripPathData}/>) : (<div className="trip-path-modal__empty">
                    No saved path is available for this trip yet.
                  </div>)}
              </div>
            </section>
          </div>)}
        {activeViolationAlert && (<div className="violation-modal-backdrop" role="presentation" onClick={closeViolationAlert}>
            <section className="violation-modal" role="dialog" aria-modal="true" aria-labelledby="admin-violation-modal-title" onClick={function (event) { return event.stopPropagation(); }}>
              <div className="violation-modal__header">
                <div className="violation-modal__title-row">
                  <div className="violation-modal__badge" aria-hidden="true">!</div>
                  <div>
                    <h2 id="admin-violation-modal-title">Violation Alert</h2>
                    <p>New driver violation detected</p>
                  </div>
                </div>
                <button type="button" className="violation-modal__close" onClick={closeViolationAlert} aria-label="Dismiss violation alert">
                Close
              </button>
              </div>

              <div className="violation-modal__body">
                {violationAlertQueue.length > 0 && (<div className="violation-modal__queue">
                    {violationAlertQueue.length} more violation
                    {violationAlertQueue.length === 1 ? " is" : "s are"} waiting.
                  </div>)}

                <div className="violation-modal__driver">
                  <div className="violation-modal__avatar" aria-hidden="true">
                    {activeViolationAlert.profileImageUrl ? (<img src={activeViolationAlert.profileImageUrl} alt=""/>) : (activeViolationInitials)}
                  </div>
                  <div className="violation-modal__driver-copy">
                    <strong>{activeViolationDriverLabel}</strong>
                    <span>{(_t = activeViolationAlert.driverCode) !== null && _t !== void 0 ? _t : "No driver code"}</span>
                  </div>
                </div>

                <div className="violation-modal__details">
                  <div>
                    <span>Plate Number</span>
                    <strong>{(_u = activeViolationAlert.plateNo) !== null && _u !== void 0 ? _u : "Not available"}</strong>
                  </div>
                  <div>
                    <span>Tricycle Number</span>
                    <strong>
                      {(_v = activeViolationAlert.tricycleNo) !== null && _v !== void 0 ? _v : (activeViolationAlert.tricycleId
                ? "Tricycle #".concat(activeViolationAlert.tricycleId)
                : "Not available")}
                    </strong>
                  </div>
                  <div>
                    <span>Trip ID</span>
                    <strong>
                      {activeViolationAlert.tripId
                ? "TRIP-".concat(String(activeViolationAlert.tripId).replace(/^TRIP-/i, ""))
                : "No active trip"}
                    </strong>
                  </div>
                  <div>
                    <span>Violation Type</span>
                    <strong>{activeViolationAlert.violationType}</strong>
                  </div>
                  <div>
                    <span>Timestamp</span>
                    <strong>{formatDateTime(activeViolationAlert.timestamp)}</strong>
                  </div>
                  <div>
                    <span>Current Location</span>
                    <strong>
                      {(_x = (_w = activeViolationAlert.locationLabel) !== null && _w !== void 0 ? _w : activeViolationCoordinates) !== null && _x !== void 0 ? _x : "Location not available"}
                    </strong>
                  </div>
                  <div>
                    <span>Coordinates</span>
                    <strong>{activeViolationCoordinates !== null && activeViolationCoordinates !== void 0 ? activeViolationCoordinates : "Not available"}</strong>
                  </div>
                  <div>
                    <span>Route</span>
                    <strong>{(_y = activeViolationAlert.routeName) !== null && _y !== void 0 ? _y : "No route context"}</strong>
                  </div>
                </div>

                {activeViolationAlert.description && (<p className="violation-modal__description">
                    {activeViolationAlert.description}
                  </p>)}

                <div className="violation-modal__actions">
                  <button type="button" className="violation-modal__button violation-modal__button--secondary" onClick={closeViolationAlert}>
                    Dismiss
                  </button>
                  <button type="button" className="violation-modal__button violation-modal__button--primary" onClick={function () { return focusViolationOnMap(activeViolationAlert); }} disabled={!hasViolationCoordinates(activeViolationAlert)}>
                    View Map
                  </button>
                </div>
              </div>
            </section>
          </div>)}
        {activeEmergencyModal && (<div className="emergency-modal-backdrop" role="presentation">
            <section className="emergency-modal" role="dialog" aria-modal="true" aria-labelledby="admin-emergency-modal-title">
              <div className="emergency-modal__header">
                <div className="emergency-modal__badge">Passenger Emergency</div>
                <h2 id="admin-emergency-modal-title">Immediate attention required</h2>
                <p className="emergency-modal__message">
                  A passenger triggered the emergency action from the QR reporting page.
                </p>
                {emergencyQueue.length > 0 && (<p className="emergency-modal__message">
                    {emergencyQueue.length} more emergency
                    {emergencyQueue.length === 1 ? " is" : "ies are"} waiting in the queue.
                  </p>)}
              </div>

              <div className="emergency-modal__body">
                <div className="emergency-modal__details">
                  <div>
                    <span>Driver</span>
                    <strong>{activeEmergencyModal.driverName}</strong>
                  </div>
                  <div>
                    <span>Plate / Unit</span>
                    <strong>{(_z = activeEmergencyModal.plateNo) !== null && _z !== void 0 ? _z : "No tricycle assigned"}</strong>
                  </div>
                  <div>
                    <span>Time</span>
                    <strong>{new Date(activeEmergencyModal.createdAt).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Route</span>
                    <strong>{(_0 = activeEmergencyModal.routeName) !== null && _0 !== void 0 ? _0 : "No route context"}</strong>
                  </div>
                </div>

                <div className="emergency-modal__meta">
                  {[activeEmergencyModal.barangayName, activeEmergencyModal.todaName, activeEmergencyModal.status]
                .filter(Boolean)
                .join(" | ")}
                </div>

                {dashboardError && (<div className="emergency-modal__error" role="alert">
                    {dashboardError.replace(/^Error:\s*/, "")}
                  </div>)}

                <div className="emergency-modal__actions">
                  <button type="button" className="emergency-modal__button" disabled={emergencyActionBusyId === activeEmergencyModal.emergencyId} onClick={function () { return void handleEmergencyResponse(activeEmergencyModal); }}>
                    {emergencyActionBusyId === activeEmergencyModal.emergencyId
                ? "Confirming..."
                : "Confirm Response"}
                  </button>
                </div>
              </div>
            </section>
          </div>)}
      </div>
    </div>);
}
