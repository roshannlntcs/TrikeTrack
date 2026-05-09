"use strict";
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
exports.createSmoothDriverMarkerManager = void 0;
var maplibre_gl_1 = require("maplibre-gl");
var MIN_ANIMATION_MS = 800;
var MAX_ANIMATION_MS = 1500;
var MAX_COORDINATE_ACCURACY_METERS = 100;
var DUPLICATE_DISTANCE_METERS = 1.5;
var SNAP_AFTER_IDLE_MS = 45000;
var RECONNECT_SNAP_DISTANCE_METERS = 250;
var MAX_EXPECTED_SPEED_METERS_PER_SECOND = 35;
var SPEED_DISTANCE_BUFFER_METERS = 35;
var OUT_OF_ORDER_TOLERANCE_MS = 5000;
var clamp = function (value, min, max) {
    return Math.min(Math.max(value, min), max);
};
var normalizeIdentifier = function (value) { return value.trim().toUpperCase(); };
var isFiniteNumber = function (value) {
    return typeof value === "number" && Number.isFinite(value);
};
var isValidCoordinate = function (_a) {
    var lng = _a.lng, lat = _a.lat;
    return isFiniteNumber(lng) && isFiniteNumber(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
};
var toRadians = function (degrees) { return (degrees * Math.PI) / 180; };
var toDegrees = function (radians) { return (radians * 180) / Math.PI; };
var distanceMeters = function (from, to) {
    var earthRadiusMeters = 6371000;
    var latDelta = toRadians(to.lat - from.lat);
    var lngDelta = toRadians(to.lng - from.lng);
    var fromLat = toRadians(from.lat);
    var toLat = toRadians(to.lat);
    var a = Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
        Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMeters * c;
};
var normalizeBearing = function (bearing) { return ((bearing % 360) + 360) % 360; };
var calculateBearing = function (from, to) {
    var fromLat = toRadians(from.lat);
    var toLat = toRadians(to.lat);
    var lngDelta = toRadians(to.lng - from.lng);
    var y = Math.sin(lngDelta) * Math.cos(toLat);
    var x = Math.cos(fromLat) * Math.sin(toLat) -
        Math.sin(fromLat) * Math.cos(toLat) * Math.cos(lngDelta);
    if (x === 0 && y === 0) {
        return 0;
    }
    return normalizeBearing(toDegrees(Math.atan2(y, x)));
};
var shortestBearingDelta = function (from, to) { return ((to - from + 540) % 360) - 180; };
var interpolateBearing = function (from, to, progress) {
    return normalizeBearing(from + shortestBearingDelta(from, to) * progress);
};
var easeInOut = function (value) {
    return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
};
var getAnimationDuration = function (deltaMs) {
    return clamp(Math.round(deltaMs * 0.8), MIN_ANIMATION_MS, MAX_ANIMATION_MS);
};
var createMarkerAppearance = function (state) { return ({
    inside: state.inside,
    onlineStatus: state.onlineStatus,
    bearing: state.bearing
}); };
var createSmoothDriverMarkerManager = function (_a) {
    var map = _a.map, createMarkerElement = _a.createMarkerElement, getPopupContent = _a.getPopupContent, updateMarkerElement = _a.updateMarkerElement;
    var markersByDriver = new Map();
    var identifiersToDriver = new Map();
    var syncPopupContent = function (state) {
        var _a;
        if (!getPopupContent)
            return;
        (_a = state.marker.getPopup()) === null || _a === void 0 ? void 0 : _a.setDOMContent(getPopupContent(state.driverIdentifier));
    };
    var syncMarkerAppearance = function (state) {
        updateMarkerElement === null || updateMarkerElement === void 0 ? void 0 : updateMarkerElement(state.marker.getElement(), createMarkerAppearance(state));
    };
    var cancelAnimation = function (state) {
        if (state.animationFrameId !== null) {
            window.cancelAnimationFrame(state.animationFrameId);
            state.animationFrameId = null;
        }
    };
    var setMarkerPosition = function (state, position) {
        state.displayedPosition = position;
        state.marker.setLngLat([position.lng, position.lat]);
    };
    var resolveDriverIdentifier = function (identifiers) {
        for (var _i = 0, identifiers_1 = identifiers; _i < identifiers_1.length; _i++) {
            var identifier = identifiers_1[_i];
            var normalized = normalizeIdentifier(identifier);
            var primary = identifiersToDriver.get(normalized);
            if (primary)
                return primary;
        }
        return null;
    };
    var registerIdentifiers = function (state, identifiers) {
        for (var _i = 0, identifiers_2 = identifiers; _i < identifiers_2.length; _i++) {
            var identifier = identifiers_2[_i];
            var normalized = normalizeIdentifier(identifier);
            if (!normalized)
                continue;
            state.aliases.add(normalized);
            identifiersToDriver.set(normalized, state.driverIdentifier);
        }
    };
    var createState = function (driverIdentifier, initialPosition, initialTimestamp, inside, onlineStatus, bearing, aliases) {
        var markerEl = createMarkerElement(driverIdentifier, {
            inside: inside,
            onlineStatus: onlineStatus,
            bearing: bearing
        });
        var marker = new maplibre_gl_1.default.Marker({ element: markerEl }).setLngLat([
            initialPosition.lng,
            initialPosition.lat
        ]);
        if (getPopupContent) {
            marker.setPopup(new maplibre_gl_1.default.Popup({ offset: 12 }).setDOMContent(getPopupContent(driverIdentifier)));
        }
        marker.addTo(map);
        var state = {
            driverIdentifier: driverIdentifier,
            aliases: new Set(),
            marker: marker,
            displayedPosition: initialPosition,
            latestReceivedPosition: initialPosition,
            lastUpdateTimestamp: initialTimestamp,
            animationFrameId: null,
            bearing: bearing,
            onlineStatus: onlineStatus,
            inside: inside
        };
        registerIdentifiers(state, __spreadArray([driverIdentifier], aliases, true));
        syncPopupContent(state);
        syncMarkerAppearance(state);
        markersByDriver.set(driverIdentifier, state);
        return state;
    };
    var animateState = function (state, nextPosition, nextBearing, durationMs) {
        cancelAnimation(state);
        var startPosition = state.displayedPosition;
        var startBearing = state.bearing;
        var startedAt = performance.now();
        var frame = function (now) {
            var elapsed = now - startedAt;
            var progress = clamp(elapsed / durationMs, 0, 1);
            var eased = easeInOut(progress);
            setMarkerPosition(state, {
                lng: startPosition.lng + (nextPosition.lng - startPosition.lng) * eased,
                lat: startPosition.lat + (nextPosition.lat - startPosition.lat) * eased
            });
            state.bearing = interpolateBearing(startBearing, nextBearing, eased);
            syncMarkerAppearance(state);
            if (progress >= 1) {
                state.animationFrameId = null;
                return;
            }
            state.animationFrameId = window.requestAnimationFrame(frame);
        };
        state.animationFrameId = window.requestAnimationFrame(frame);
    };
    var upsert = function (_a) {
        var _b;
        var driverIdentifier = _a.driverIdentifier, _c = _a.aliases, aliases = _c === void 0 ? [] : _c, position = _a.position, timestamp = _a.timestamp, accuracy = _a.accuracy, heading = _a.heading, speed = _a.speed, inside = _a.inside, onlineStatus = _a.onlineStatus;
        if (!isValidCoordinate(position)) {
            return { accepted: false, snapped: false, position: null };
        }
        if (isFiniteNumber(accuracy) && accuracy > MAX_COORDINATE_ACCURACY_METERS) {
            return { accepted: false, snapped: false, position: null };
        }
        var normalizedDriverIdentifier = normalizeIdentifier(driverIdentifier);
        var resolvedDriverIdentifier = (_b = resolveDriverIdentifier(__spreadArray([normalizedDriverIdentifier], aliases, true))) !== null && _b !== void 0 ? _b : normalizedDriverIdentifier;
        var state = markersByDriver.get(resolvedDriverIdentifier);
        if (!state) {
            var bearing = isFiniteNumber(heading) ? normalizeBearing(heading) : 0;
            state = createState(resolvedDriverIdentifier, position, timestamp, inside, onlineStatus, bearing, aliases);
            return {
                accepted: true,
                snapped: true,
                position: state.displayedPosition
            };
        }
        registerIdentifiers(state, __spreadArray([normalizedDriverIdentifier], aliases, true));
        if (timestamp < state.lastUpdateTimestamp - OUT_OF_ORDER_TOLERANCE_MS) {
            return { accepted: false, snapped: false, position: state.displayedPosition };
        }
        var duplicateDistance = distanceMeters(state.latestReceivedPosition, position);
        if (duplicateDistance <= DUPLICATE_DISTANCE_METERS) {
            state.lastUpdateTimestamp = Math.max(state.lastUpdateTimestamp, timestamp);
            state.onlineStatus = onlineStatus;
            state.inside = inside;
            syncPopupContent(state);
            syncMarkerAppearance(state);
            return {
                accepted: false,
                snapped: false,
                position: state.displayedPosition
            };
        }
        var displayedDistance = distanceMeters(state.displayedPosition, position);
        var gapMs = Math.max(0, timestamp - state.lastUpdateTimestamp);
        var shouldSnapForStaleGap = gapMs >= SNAP_AFTER_IDLE_MS;
        var shouldSnapForFarReconnect = state.onlineStatus === "offline" && displayedDistance >= RECONNECT_SNAP_DISTANCE_METERS;
        var shouldSnap = shouldSnapForStaleGap || shouldSnapForFarReconnect;
        if (!shouldSnap) {
            var gapSeconds = Math.max(gapMs, 1000) / 1000;
            var reportedSpeedMetersPerSecond = isFiniteNumber(speed) ? Math.max(speed, 0) : 0;
            var allowedDistance = Math.max(MAX_EXPECTED_SPEED_METERS_PER_SECOND, reportedSpeedMetersPerSecond) * gapSeconds +
                SPEED_DISTANCE_BUFFER_METERS;
            if (displayedDistance > allowedDistance) {
                return {
                    accepted: false,
                    snapped: false,
                    position: state.displayedPosition
                };
            }
        }
        cancelAnimation(state);
        state.latestReceivedPosition = position;
        state.lastUpdateTimestamp = Math.max(state.lastUpdateTimestamp, timestamp);
        state.onlineStatus = onlineStatus;
        state.inside = inside;
        syncPopupContent(state);
        var nextBearing = isFiniteNumber(heading) && displayedDistance > DUPLICATE_DISTANCE_METERS
            ? normalizeBearing(heading)
            : displayedDistance > DUPLICATE_DISTANCE_METERS
                ? calculateBearing(state.displayedPosition, position)
                : state.bearing;
        if (shouldSnap) {
            state.bearing = nextBearing;
            setMarkerPosition(state, position);
            syncMarkerAppearance(state);
            return {
                accepted: true,
                snapped: true,
                position: state.displayedPosition
            };
        }
        animateState(state, position, nextBearing, getAnimationDuration(gapMs));
        return {
            accepted: true,
            snapped: false,
            position: position
        };
    };
    var setOffline = function (identifiers, lastSeenTs) {
        var resolvedDriverIdentifier = resolveDriverIdentifier(identifiers);
        if (!resolvedDriverIdentifier)
            return;
        var state = markersByDriver.get(resolvedDriverIdentifier);
        if (!state)
            return;
        if (typeof lastSeenTs === "number" && Number.isFinite(lastSeenTs)) {
            state.lastUpdateTimestamp = Math.max(state.lastUpdateTimestamp, lastSeenTs);
        }
        state.onlineStatus = "offline";
        syncMarkerAppearance(state);
    };
    var remove = function (identifiers) {
        var resolvedDriverIdentifier = resolveDriverIdentifier(identifiers);
        if (!resolvedDriverIdentifier)
            return;
        var state = markersByDriver.get(resolvedDriverIdentifier);
        if (!state)
            return;
        cancelAnimation(state);
        state.marker.remove();
        markersByDriver.delete(resolvedDriverIdentifier);
        for (var _i = 0, _a = state.aliases; _i < _a.length; _i++) {
            var identifier = _a[_i];
            identifiersToDriver.delete(identifier);
        }
    };
    var getDisplayedPosition = function (identifiers) {
        var _a, _b;
        var resolvedDriverIdentifier = resolveDriverIdentifier(identifiers);
        if (!resolvedDriverIdentifier)
            return null;
        return (_b = (_a = markersByDriver.get(resolvedDriverIdentifier)) === null || _a === void 0 ? void 0 : _a.displayedPosition) !== null && _b !== void 0 ? _b : null;
    };
    var destroy = function () {
        for (var _i = 0, _a = markersByDriver.values(); _i < _a.length; _i++) {
            var state = _a[_i];
            cancelAnimation(state);
            state.marker.remove();
        }
        markersByDriver.clear();
        identifiersToDriver.clear();
    };
    return {
        upsert: upsert,
        setOffline: setOffline,
        remove: remove,
        getDisplayedPosition: getDisplayedPosition,
        destroy: destroy
    };
};
exports.createSmoothDriverMarkerManager = createSmoothDriverMarkerManager;
