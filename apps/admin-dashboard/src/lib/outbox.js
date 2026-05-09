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
exports.groupOutboxByType = void 0;
exports.syncOutbox = syncOutbox;
var db_1 = require("./db");
function syncOutbox(endpoint_1) {
    return __awaiter(this, arguments, void 0, function (endpoint, limit) {
        var items, response, payload, results, resultById, accepted, rejected, _i, items_1, item, result, error_1;
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, db_1.getOutboxItems)(limit)];
                case 1:
                    items = _a.sent();
                    if (items.length === 0) {
                        return [2 /*return*/, { sent: 0, pending: 0, failed: 0 }];
                    }
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 9, , 11]);
                    return [4 /*yield*/, fetch(endpoint, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                violations: items.map(function (item) {
                                    var _a, _b;
                                    return ({
                                        id: item.id,
                                        type: "violation",
                                        driverId: item.payload.driverId,
                                        ts: item.payload.ts,
                                        lng: item.payload.lng,
                                        lat: item.payload.lat,
                                        reason: (_a = item.payload.reason) !== null && _a !== void 0 ? _a : "OUTSIDE_ROUTE_CORRIDOR",
                                        routeId: (_b = item.payload.routeId) !== null && _b !== void 0 ? _b : "umasa-brgy-18b-geofence",
                                        speed: item.payload.speed,
                                        heading: item.payload.heading,
                                        accuracy: item.payload.accuracy
                                    });
                                })
                            })
                        })];
                case 3:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, db_1.bumpOutboxAttempts)(items.map(function (item) { return item.id; }))];
                case 4:
                    _a.sent();
                    return [2 /*return*/, {
                            sent: 0,
                            pending: items.length,
                            failed: items.length,
                            lastError: "HTTP ".concat(response.status)
                        }];
                case 5: return [4 /*yield*/, response.json()];
                case 6:
                    payload = (_a.sent());
                    results = Array.isArray(payload.results) ? payload.results : [];
                    resultById = new Map(results.map(function (result) { return [result.id, result]; }));
                    accepted = [];
                    rejected = [];
                    for (_i = 0, items_1 = items; _i < items_1.length; _i++) {
                        item = items_1[_i];
                        result = resultById.get(item.id);
                        if (!result) {
                            accepted.push(item.id);
                            continue;
                        }
                        if (result.status === "stored" || result.status === "duplicate") {
                            accepted.push(item.id);
                        }
                        else {
                            rejected.push(item.id);
                        }
                    }
                    return [4 /*yield*/, (0, db_1.removeOutboxItems)(accepted)];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, (0, db_1.bumpOutboxAttempts)(rejected)];
                case 8:
                    _a.sent();
                    return [2 /*return*/, {
                            sent: accepted.length,
                            pending: Math.max(0, items.length - accepted.length),
                            failed: rejected.length
                        }];
                case 9:
                    error_1 = _a.sent();
                    return [4 /*yield*/, (0, db_1.bumpOutboxAttempts)(items.map(function (item) { return item.id; }))];
                case 10:
                    _a.sent();
                    return [2 /*return*/, {
                            sent: 0,
                            pending: items.length,
                            failed: items.length,
                            lastError: String(error_1)
                        }];
                case 11: return [2 /*return*/];
            }
        });
    });
}
var groupOutboxByType = function (items) {
    return items.reduce(function (acc, item) {
        var _a;
        acc[item.type] = ((_a = acc[item.type]) !== null && _a !== void 0 ? _a : 0) + 1;
        return acc;
    }, {});
};
exports.groupOutboxByType = groupOutboxByType;
