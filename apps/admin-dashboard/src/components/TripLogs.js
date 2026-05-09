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
exports.default = TripLogs;
var react_1 = require("react");
var db_1 = require("../lib/db");
function TripLogs(_a) {
    var _this = this;
    var _b = _a.limit, limit = _b === void 0 ? 20 : _b, _c = _a.refreshMs, refreshMs = _c === void 0 ? 3000 : _c, status = _a.status, lastUpdateTs = _a.lastUpdateTs, online = _a.online, _d = _a.outboxCount, outboxCount = _d === void 0 ? 0 : _d, _e = _a.outboxStatus, outboxStatus = _e === void 0 ? "idle" : _e;
    var _f = (0, react_1.useState)([]), points = _f[0], setPoints = _f[1];
    var _g = (0, react_1.useState)(null), error = _g[0], setError = _g[1];
    (0, react_1.useEffect)(function () {
        var timer;
        var load = function () { return __awaiter(_this, void 0, void 0, function () {
            var data, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, db_1.getRecentPoints)(limit)];
                    case 1:
                        data = _a.sent();
                        setPoints(data);
                        setError(null);
                        return [3 /*break*/, 3];
                    case 2:
                        err_1 = _a.sent();
                        setError(String(err_1));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); };
        void load();
        timer = window.setInterval(load, refreshMs);
        return function () {
            if (timer)
                window.clearInterval(timer);
        };
    }, [limit, refreshMs]);
    var statusLabel = (function () {
        if (online === false)
            return "Offline (cached)";
        if (status === "connected")
            return "Live";
        if (status === "connecting")
            return "Connecting";
        if (status === "disconnected")
            return "Disconnected";
        return "Unknown";
    })();
    var lastUpdateLabel = lastUpdateTs
        ? new Date(lastUpdateTs).toLocaleTimeString()
        : "-";
    var outboxStatusLabel = (function () {
        if (outboxStatus === "syncing")
            return "Syncing";
        if (outboxStatus === "error")
            return "Error";
        if (outboxStatus === "offline")
            return "Offline";
        return "Idle";
    })();
    return (<div style={{
            border: "1px solid #e0e0e0",
            borderRadius: "12px",
            padding: "12px"
        }}>
      <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
        Trip Logs (Last {limit})
      </div>
      <div style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr",
            gap: "8px",
            fontSize: "12px",
            color: "#4b5563",
            marginBottom: "10px"
        }}>
        <div>Status: {statusLabel}</div>
        <div>Last Update: {lastUpdateLabel}</div>
        <div>Outbox: {outboxCount} pending</div>
        <div>Sync: {outboxStatusLabel}</div>
      </div>
      {error ? (<div style={{ color: "#b91c1c" }}>Failed to load: {error}</div>) : points.length === 0 ? (<div style={{ color: "#6b7280" }}>No points saved yet.</div>) : (<div style={{ display: "grid", gap: "6px" }}>
          {points.map(function (point) {
                var _a;
                return (<div key={(_a = point.id) !== null && _a !== void 0 ? _a : "".concat(point.driverId, "-").concat(point.ts)} style={{
                        display: "grid",
                        gridTemplateColumns: "120px 1fr 1fr 1fr",
                        gap: "8px",
                        fontSize: "13px"
                    }}>
              <div>{new Date(point.ts).toLocaleTimeString()}</div>
              <div>{point.driverId}</div>
              <div>
                {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
              </div>
              <div style={{ color: point.violation ? "#b91c1c" : "#15803d" }}>
                {point.violation ? "VIOLATION" : "OK"}
              </div>
            </div>);
            })}
        </div>)}
    </div>);
}
