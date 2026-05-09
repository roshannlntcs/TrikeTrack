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
exports.deleteMasterDataItem = exports.updateMasterDataItem = exports.createMasterDataItem = exports.fetchMasterData = void 0;
var db_1 = require("./db");
var MASTER_DATA_CACHE_KEY = "master-data";
var withCacheMeta = function (cached) { return (__assign(__assign({}, cached.data), { cacheMeta: {
        fromCache: true,
        savedAt: new Date(cached.savedAt).toISOString()
    } })); };
var parseError = function (response) { return __awaiter(void 0, void 0, void 0, function () {
    var payload;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, response.json().catch(function () { return ({}); })];
            case 1:
                payload = (_b.sent());
                return [2 /*return*/, (_a = payload.message) !== null && _a !== void 0 ? _a : "HTTP ".concat(response.status)];
        }
    });
}); };
var request = function (accessToken, init) { return __awaiter(void 0, void 0, void 0, function () {
    var response, _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, fetch("/api/admin/master-data", __assign(__assign({}, init), { headers: __assign({ "Content-Type": "application/json", Authorization: "Bearer ".concat(accessToken) }, ((_b = init.headers) !== null && _b !== void 0 ? _b : {})) }))];
            case 1:
                response = _c.sent();
                if (!!response.ok) return [3 /*break*/, 3];
                _a = Error.bind;
                return [4 /*yield*/, parseError(response)];
            case 2: throw new (_a.apply(Error, [void 0, _c.sent()]))();
            case 3: return [4 /*yield*/, response.json()];
            case 4: return [2 /*return*/, (_c.sent())];
        }
    });
}); };
var fetchMasterData = function (accessToken) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_1, cached;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 5]);
                return [4 /*yield*/, request(accessToken, { method: "GET" })];
            case 1:
                response = _a.sent();
                if (!response.data) {
                    throw new Error("Master data response was missing data.");
                }
                return [4 /*yield*/, (0, db_1.saveSnapshot)(MASTER_DATA_CACHE_KEY, response.data)];
            case 2:
                _a.sent();
                return [2 /*return*/, response.data];
            case 3:
                error_1 = _a.sent();
                return [4 /*yield*/, (0, db_1.getSnapshot)(MASTER_DATA_CACHE_KEY)];
            case 4:
                cached = _a.sent();
                if (cached) {
                    return [2 /*return*/, withCacheMeta(cached)];
                }
                throw error_1;
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.fetchMasterData = fetchMasterData;
var createMasterDataItem = function (accessToken, entity, payload) { return __awaiter(void 0, void 0, void 0, function () {
    var response;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, request(accessToken, {
                    method: "POST",
                    body: JSON.stringify({ entity: entity, payload: payload })
                })];
            case 1:
                response = _a.sent();
                return [2 /*return*/, response.item];
        }
    });
}); };
exports.createMasterDataItem = createMasterDataItem;
var updateMasterDataItem = function (accessToken, entity, id, payload) { return __awaiter(void 0, void 0, void 0, function () {
    var response;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, request(accessToken, {
                    method: "PATCH",
                    body: JSON.stringify({ entity: entity, id: id, payload: payload })
                })];
            case 1:
                response = _a.sent();
                return [2 /*return*/, response.item];
        }
    });
}); };
exports.updateMasterDataItem = updateMasterDataItem;
var deleteMasterDataItem = function (accessToken, entity, id) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, request(accessToken, {
                    method: "DELETE",
                    body: JSON.stringify({ entity: entity, id: id })
                })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.deleteMasterDataItem = deleteMasterDataItem;
