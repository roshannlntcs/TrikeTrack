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
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbPromise = void 0;
exports.savePoint = savePoint;
exports.getRecentPoints = getRecentPoints;
exports.enqueueViolation = enqueueViolation;
exports.getOutboxItems = getOutboxItems;
exports.getOutboxCount = getOutboxCount;
exports.removeOutboxItems = removeOutboxItems;
exports.bumpOutboxAttempts = bumpOutboxAttempts;
exports.saveSnapshot = saveSnapshot;
exports.getSnapshot = getSnapshot;
var idb_1 = require("idb");
var createPointId = function (point) {
    var lngBucket = Math.round(point.lng * 100000);
    var latBucket = Math.round(point.lat * 100000);
    return "".concat(point.driverId, "|").concat(point.ts, "|").concat(lngBucket, ":").concat(latBucket);
};
exports.dbPromise = (0, idb_1.openDB)("triketrack-admin", 4, {
    upgrade: function (db, oldVersion) {
        if (oldVersion < 1 && !db.objectStoreNames.contains("points")) {
            db.createObjectStore("points", { keyPath: "ts" });
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains("outbox")) {
            db.createObjectStore("outbox", { keyPath: "id" });
        }
        if (oldVersion < 3 && db.objectStoreNames.contains("points")) {
            db.deleteObjectStore("points");
            db.createObjectStore("points", { keyPath: "id" });
        }
        if (oldVersion < 4 && !db.objectStoreNames.contains("snapshots")) {
            db.createObjectStore("snapshots", { keyPath: "key" });
        }
    }
});
function savePoint(p) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, exports.dbPromise];
                case 1:
                    db = _b.sent();
                    return [4 /*yield*/, db.put("points", __assign(__assign({}, p), { id: (_a = p.id) !== null && _a !== void 0 ? _a : createPointId(p) }))];
                case 2:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getRecentPoints() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var db, all;
        if (limit === void 0) { limit = 200; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, exports.dbPromise];
                case 1:
                    db = _a.sent();
                    return [4 /*yield*/, db.getAll("points")];
                case 2:
                    all = _a.sent();
                    return [2 /*return*/, all.sort(function (a, b) { return b.ts - a.ts; }).slice(0, limit)];
            }
        });
    });
}
var createOutboxId = function () {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return "ob-".concat(Date.now(), "-").concat(Math.random().toString(16).slice(2));
};
function enqueueViolation(payload) {
    return __awaiter(this, void 0, void 0, function () {
        var db, item;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, exports.dbPromise];
                case 1:
                    db = _a.sent();
                    item = {
                        id: createOutboxId(),
                        type: "violation",
                        createdAt: Date.now(),
                        attempts: 0,
                        payload: payload
                    };
                    return [4 /*yield*/, db.put("outbox", item)];
                case 2:
                    _a.sent();
                    return [2 /*return*/, item];
            }
        });
    });
}
function getOutboxItems() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var db, all;
        if (limit === void 0) { limit = 200; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, exports.dbPromise];
                case 1:
                    db = _a.sent();
                    return [4 /*yield*/, db.getAll("outbox")];
                case 2:
                    all = (_a.sent());
                    return [2 /*return*/, all.sort(function (a, b) { return a.createdAt - b.createdAt; }).slice(0, limit)];
            }
        });
    });
}
function getOutboxCount() {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, exports.dbPromise];
                case 1:
                    db = _a.sent();
                    return [2 /*return*/, db.count("outbox")];
            }
        });
    });
}
function removeOutboxItems(ids) {
    return __awaiter(this, void 0, void 0, function () {
        var db, tx, _i, ids_1, id;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (ids.length === 0)
                        return [2 /*return*/];
                    return [4 /*yield*/, exports.dbPromise];
                case 1:
                    db = _a.sent();
                    tx = db.transaction("outbox", "readwrite");
                    _i = 0, ids_1 = ids;
                    _a.label = 2;
                case 2:
                    if (!(_i < ids_1.length)) return [3 /*break*/, 5];
                    id = ids_1[_i];
                    return [4 /*yield*/, tx.store.delete(id)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [4 /*yield*/, tx.done];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function bumpOutboxAttempts(ids) {
    return __awaiter(this, void 0, void 0, function () {
        var db, tx, _i, ids_2, id, item;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (ids.length === 0)
                        return [2 /*return*/];
                    return [4 /*yield*/, exports.dbPromise];
                case 1:
                    db = _a.sent();
                    tx = db.transaction("outbox", "readwrite");
                    _i = 0, ids_2 = ids;
                    _a.label = 2;
                case 2:
                    if (!(_i < ids_2.length)) return [3 /*break*/, 6];
                    id = ids_2[_i];
                    return [4 /*yield*/, tx.store.get(id)];
                case 3:
                    item = (_a.sent());
                    if (!item)
                        return [3 /*break*/, 5];
                    return [4 /*yield*/, tx.store.put(__assign(__assign({}, item), { attempts: item.attempts + 1 }))];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 2];
                case 6: return [4 /*yield*/, tx.done];
                case 7:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function saveSnapshot(key, data) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, exports.dbPromise];
                case 1:
                    db = _a.sent();
                    return [4 /*yield*/, db.put("snapshots", {
                            key: key,
                            savedAt: Date.now(),
                            data: data
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getSnapshot(key) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, exports.dbPromise];
                case 1:
                    db = _a.sent();
                    return [4 /*yield*/, db.get("snapshots", key)];
                case 2: return [2 /*return*/, (_a.sent())];
            }
        });
    });
}
