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
exports.updateEmergencyAlertStatus = exports.connectAdminEmergencyStream = void 0;
var delay = function (ms) { return new Promise(function (resolve) { return window.setTimeout(resolve, ms); }); };
var parseSseChunk = function (chunk, onEvent) {
    var _a;
    var blocks = chunk.split("\n\n");
    var trailing = (_a = blocks.pop()) !== null && _a !== void 0 ? _a : "";
    for (var _i = 0, blocks_1 = blocks; _i < blocks_1.length; _i++) {
        var block = blocks_1[_i];
        var lines = block.split("\n");
        var eventName = "message";
        var dataLines = [];
        for (var _b = 0, lines_1 = lines; _b < lines_1.length; _b++) {
            var line = lines_1[_b];
            if (line.startsWith("event:")) {
                eventName = line.slice("event:".length).trim();
                continue;
            }
            if (line.startsWith("data:")) {
                dataLines.push(line.slice("data:".length).trim());
            }
        }
        if (dataLines.length > 0) {
            onEvent(eventName, dataLines.join("\n"));
        }
    }
    return trailing;
};
var connectAdminEmergencyStream = function (accessToken, handlers) {
    var disposed = false;
    var activeController = null;
    var run = function () { return __awaiter(void 0, void 0, void 0, function () {
        var reconnectDelayMs, controller, response, reader, decoder, buffer, _a, value, done, error_1;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    reconnectDelayMs = 1500;
                    _c.label = 1;
                case 1:
                    if (!!disposed) return [3 /*break*/, 11];
                    controller = new AbortController();
                    activeController = controller;
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 7, , 10]);
                    return [4 /*yield*/, fetch("/api/admin/emergencies/stream", {
                            headers: {
                                Authorization: "Bearer ".concat(accessToken)
                            },
                            signal: controller.signal,
                            cache: "no-store"
                        })];
                case 3:
                    response = _c.sent();
                    if (!response.ok || !response.body) {
                        throw new Error("Emergency stream returned HTTP ".concat(response.status, "."));
                    }
                    reconnectDelayMs = 1500;
                    reader = response.body.getReader();
                    decoder = new TextDecoder();
                    buffer = "";
                    _c.label = 4;
                case 4:
                    if (!!disposed) return [3 /*break*/, 6];
                    return [4 /*yield*/, reader.read()];
                case 5:
                    _a = _c.sent(), value = _a.value, done = _a.done;
                    if (done)
                        return [3 /*break*/, 6];
                    buffer += decoder.decode(value, { stream: true });
                    buffer = parseSseChunk(buffer, function (eventName, payload) {
                        var _a, _b, _c, _d;
                        try {
                            if (eventName === "snapshot") {
                                var parsed = JSON.parse(payload);
                                (_a = handlers.onSnapshot) === null || _a === void 0 ? void 0 : _a.call(handlers, (_b = parsed.items) !== null && _b !== void 0 ? _b : []);
                                return;
                            }
                            if (eventName === "emergency") {
                                var parsed = JSON.parse(payload);
                                if (parsed.alert) {
                                    (_c = handlers.onEmergency) === null || _c === void 0 ? void 0 : _c.call(handlers, parsed.alert);
                                }
                            }
                        }
                        catch (error) {
                            (_d = handlers.onError) === null || _d === void 0 ? void 0 : _d.call(handlers, error);
                        }
                    });
                    return [3 /*break*/, 4];
                case 6: return [3 /*break*/, 10];
                case 7:
                    error_1 = _c.sent();
                    if (!!disposed) return [3 /*break*/, 9];
                    (_b = handlers.onError) === null || _b === void 0 ? void 0 : _b.call(handlers, error_1);
                    return [4 /*yield*/, delay(reconnectDelayMs)];
                case 8:
                    _c.sent();
                    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 10000);
                    _c.label = 9;
                case 9: return [3 /*break*/, 10];
                case 10: return [3 /*break*/, 1];
                case 11: return [2 /*return*/];
            }
        });
    }); };
    void run();
    return function () {
        disposed = true;
        activeController === null || activeController === void 0 ? void 0 : activeController.abort();
    };
};
exports.connectAdminEmergencyStream = connectAdminEmergencyStream;
var updateEmergencyAlertStatus = function (accessToken, emergencyId, status) { return __awaiter(void 0, void 0, void 0, function () {
    var response, payload;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, fetch("/api/admin/emergencies", {
                    method: "PATCH",
                    headers: {
                        Authorization: "Bearer ".concat(accessToken),
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        emergencyId: emergencyId,
                        status: status
                    })
                })];
            case 1:
                response = _b.sent();
                return [4 /*yield*/, response.json().catch(function () { return ({}); })];
            case 2:
                payload = (_b.sent());
                if (!response.ok || !payload.data) {
                    throw new Error((_a = payload.message) !== null && _a !== void 0 ? _a : "Emergency API returned HTTP ".concat(response.status, "."));
                }
                return [2 /*return*/, payload.data];
        }
    });
}); };
exports.updateEmergencyAlertStatus = updateEmergencyAlertStatus;
