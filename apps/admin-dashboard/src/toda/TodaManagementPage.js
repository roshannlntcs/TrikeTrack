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
exports.default = TodaManagementPage;
var react_1 = require("react");
var qrcode_1 = require("qrcode");
var dashboard_data_1 = require("../lib/dashboard-data");
var reports_1 = require("../lib/reports");
var superadmin_api_1 = require("../lib/superadmin-api");
var DeleteConfirmDialog_1 = require("../components/DeleteConfirmDialog");
require("./TodaManagementPage.css");
var STATUS_OPTIONS = [
    "all",
    "active",
    "inactive",
    "suspended"
];
var initialMasterData = {
    administrators: [],
    barangays: [],
    todas: [],
    drivers: [],
    tricycles: [],
    routes: []
};
var createInitialDriverForm = function () { return ({
    firstName: "",
    lastName: "",
    contactNo: "",
    tricycleId: "",
    status: "active"
}); };
var createInitialTricycleForm = function () { return ({
    plateNo: "",
    regNo: "",
    permitExpirationDate: "",
    status: "active"
}); };
var toDateInputValue = function (value) { return (value ? value.slice(0, 10) : ""); };
var toTitleCase = function (value) { return value.charAt(0).toUpperCase() + value.slice(1); };
var formatStatusLabel = function (value) { return toTitleCase(value); };
var formatTricycleCode = function (tricycleId) { return "T".concat(String(tricycleId).padStart(3, "0")); };
var formatDateTime = function (value) { return (value ? new Date(value).toLocaleString() : "Not set"); };
var formatCurrency = function (value) {
    return value !== undefined ? "PHP ".concat(value.toFixed(2)) : "Not set";
};
var formatTripStatusLabel = function (value) { return toTitleCase(value); };
var firstConfiguredUrl = function () {
    var _a;
    var values = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        values[_i] = arguments[_i];
    }
    return (_a = values.map(function (value) { return value === null || value === void 0 ? void 0 : value.trim(); }).find(function (value) { return Boolean(value); })) !== null && _a !== void 0 ? _a : "";
};
var normalizePublicBaseUrl = function (value) {
    try {
        var parsed = new URL(value.trim());
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return null;
        }
        if (isLoopbackHostname(parsed.hostname) || isPrivateIpv4Hostname(parsed.hostname)) {
            return null;
        }
        return parsed.toString().replace(/\/+$/, "");
    }
    catch (_a) {
        return null;
    }
};
var REPORT_BASE_URL = firstConfiguredUrl(import.meta.env.VITE_PUBLIC_PASSENGER_REPORT_BASE_URL, import.meta.env.VITE_PUBLIC_REPORT_BASE_URL, import.meta.env.VITE_PASSENGER_REPORT_BASE_URL, import.meta.env.VITE_VERCEL_PROJECT_PRODUCTION_URL
    ? "https://".concat(import.meta.env.VITE_VERCEL_PROJECT_PRODUCTION_URL)
    : undefined, import.meta.env.VITE_VERCEL_URL
    ? "https://".concat(import.meta.env.VITE_VERCEL_URL)
    : undefined, import.meta.env.VITE_NETLIFY_URL
    ? "https://".concat(import.meta.env.VITE_NETLIFY_URL)
    : undefined, import.meta.env.VITE_DEPLOY_PRIME_URL);
var REPORTING_API_BASE_URL = firstConfiguredUrl(import.meta.env.VITE_PUBLIC_BACKEND_BASE_URL, import.meta.env.VITE_PUBLIC_API_BASE_URL, import.meta.env.VITE_BACKEND_BASE_URL);
var LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
var isLoopbackHostname = function (hostname) {
    var normalized = hostname.trim().toLowerCase();
    return LOOPBACK_HOSTS.has(normalized);
};
var isPrivateIpv4Hostname = function (hostname) {
    var match = hostname.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!match)
        return false;
    var octets = match.slice(1).map(function (part) { return Number(part); });
    if (octets.some(function (part) { return Number.isNaN(part) || part < 0 || part > 255; })) {
        return false;
    }
    var a = octets[0], b = octets[1];
    return (a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168));
};
var resolvePassengerReportBaseUrl = function () {
    if (!REPORT_BASE_URL) {
        return {
            url: null,
            error: "Passenger report URL is not configured. Set VITE_PUBLIC_PASSENGER_REPORT_BASE_URL to a public passenger reporting deployment URL."
        };
    }
    try {
        var parsed = new URL(REPORT_BASE_URL);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return {
                url: null,
                error: "Passenger report URL must use http:// or https://."
            };
        }
        if (isLoopbackHostname(parsed.hostname)) {
            return {
                url: null,
                error: "Passenger report URL cannot use localhost or 127.0.0.1. Use a public deployment URL that any phone can reach."
            };
        }
        if (isPrivateIpv4Hostname(parsed.hostname)) {
            return {
                url: null,
                error: "Passenger report URL cannot use a private LAN IP. Use a public deployment URL that any phone can reach over the internet."
            };
        }
        return {
            url: parsed.toString().replace(/\/+$/, ""),
            error: null
        };
    }
    catch (_a) {
        return {
            url: null,
            error: "Passenger report URL is invalid. Set VITE_PUBLIC_PASSENGER_REPORT_BASE_URL to a full public URL like https://your-app.vercel.app."
        };
    }
};
var PASSENGER_REPORT_BASE = resolvePassengerReportBaseUrl();
var resolvePassengerReportingApiBaseUrl = function () {
    var configured = normalizePublicBaseUrl(REPORTING_API_BASE_URL);
    if (configured) {
        return configured;
    }
    if (typeof window === "undefined") {
        return null;
    }
    return normalizePublicBaseUrl(window.location.origin);
};
var buildPassengerReportUrl = function (reportPath) {
    if (!reportPath || !PASSENGER_REPORT_BASE.url)
        return "";
    var targetUrl = new URL("".concat(PASSENGER_REPORT_BASE.url).concat(reportPath));
    var apiBase = resolvePassengerReportingApiBaseUrl();
    if (apiBase) {
        targetUrl.searchParams.set("apiBase", apiBase);
    }
    return targetUrl.toString();
};
function TodaManagementPage(_a) {
    var _this = this;
    var _b, _c, _d, _e, _f, _g;
    var accessToken = _a.accessToken, page = _a.page, lockedTodaId = _a.lockedTodaId, lockedTodaLabel = _a.lockedTodaLabel, controlledSearchQuery = _a.searchQuery, onSearchQueryChange = _a.onSearchQueryChange, onDataChanged = _a.onDataChanged, onDriverDeleted = _a.onDriverDeleted;
    var isDriverPage = page === "drivers";
    var _h = (0, react_1.useState)(initialMasterData), data = _h[0], setData = _h[1];
    var _j = (0, react_1.useState)(true), loading = _j[0], setLoading = _j[1];
    var _k = (0, react_1.useState)(null), error = _k[0], setError = _k[1];
    var _l = (0, react_1.useState)(null), notice = _l[0], setNotice = _l[1];
    var _m = (0, react_1.useState)(null), busyKey = _m[0], setBusyKey = _m[1];
    var _o = (0, react_1.useState)([]), driverTrips = _o[0], setDriverTrips = _o[1];
    var _p = (0, react_1.useState)([]), driverReports = _p[0], setDriverReports = _p[1];
    var _q = (0, react_1.useState)(true), tripHistoryLoading = _q[0], setTripHistoryLoading = _q[1];
    var _r = (0, react_1.useState)(null), tripHistoryError = _r[0], setTripHistoryError = _r[1];
    var _s = (0, react_1.useState)(true), reportHistoryLoading = _s[0], setReportHistoryLoading = _s[1];
    var _t = (0, react_1.useState)(null), reportHistoryError = _t[0], setReportHistoryError = _t[1];
    var _u = (0, react_1.useState)(""), localSearchQuery = _u[0], setLocalSearchQuery = _u[1];
    var _v = (0, react_1.useState)("all"), statusFilter = _v[0], setStatusFilter = _v[1];
    var _w = (0, react_1.useState)(false), isModalOpen = _w[0], setIsModalOpen = _w[1];
    var _x = (0, react_1.useState)("create"), modalMode = _x[0], setModalMode = _x[1];
    var _y = (0, react_1.useState)(null), selectedDriver = _y[0], setSelectedDriver = _y[1];
    var _z = (0, react_1.useState)(null), selectedDriverDetails = _z[0], setSelectedDriverDetails = _z[1];
    var _0 = (0, react_1.useState)(null), selectedTricycle = _0[0], setSelectedTricycle = _0[1];
    var _1 = (0, react_1.useState)(createInitialDriverForm), driverForm = _1[0], setDriverForm = _1[1];
    var _2 = (0, react_1.useState)(createInitialTricycleForm), tricycleForm = _2[0], setTricycleForm = _2[1];
    var _3 = (0, react_1.useState)(null), pendingDelete = _3[0], setPendingDelete = _3[1];
    var _4 = (0, react_1.useState)(null), qrPreviewDataUrl = _4[0], setQrPreviewDataUrl = _4[1];
    var loadMasterData = function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, masterSnapshot, dashboardSnapshot, reportsSnapshot, snapshot, loadError_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    setLoading(true);
                    setTripHistoryLoading(true);
                    setReportHistoryLoading(true);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, Promise.allSettled([
                            (0, superadmin_api_1.fetchMasterData)(accessToken),
                            (0, dashboard_data_1.fetchDashboardData)(accessToken),
                            (0, reports_1.fetchAdminReports)(accessToken)
                        ])];
                case 2:
                    _a = _b.sent(), masterSnapshot = _a[0], dashboardSnapshot = _a[1], reportsSnapshot = _a[2];
                    if (masterSnapshot.status === "rejected") {
                        throw masterSnapshot.reason;
                    }
                    snapshot = masterSnapshot.value;
                    setData(snapshot);
                    setError(null);
                    if (dashboardSnapshot.status === "fulfilled") {
                        setDriverTrips(dashboardSnapshot.value.recentTrips);
                        setTripHistoryError(null);
                    }
                    else {
                        setDriverTrips([]);
                        setTripHistoryError(String(dashboardSnapshot.reason));
                    }
                    if (reportsSnapshot.status === "fulfilled") {
                        setDriverReports(reportsSnapshot.value.reports);
                        setReportHistoryError(null);
                    }
                    else {
                        setDriverReports([]);
                        setReportHistoryError(String(reportsSnapshot.reason));
                    }
                    return [3 /*break*/, 5];
                case 3:
                    loadError_1 = _b.sent();
                    setError(String(loadError_1));
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    setTripHistoryLoading(false);
                    setReportHistoryLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    (0, react_1.useEffect)(function () {
        void loadMasterData();
    }, [accessToken]);
    (0, react_1.useEffect)(function () {
        if (!isModalOpen && !selectedDriverDetails)
            return;
        var handleKeyDown = function (event) {
            if (event.key !== "Escape")
                return;
            if (selectedDriverDetails) {
                setSelectedDriverDetails(null);
                return;
            }
            closeModal();
        };
        window.addEventListener("keydown", handleKeyDown);
        return function () { return window.removeEventListener("keydown", handleKeyDown); };
    }, [isModalOpen, selectedDriverDetails]);
    var searchQuery = controlledSearchQuery !== null && controlledSearchQuery !== void 0 ? controlledSearchQuery : localSearchQuery;
    var setSearchQuery = onSearchQueryChange !== null && onSearchQueryChange !== void 0 ? onSearchQueryChange : setLocalSearchQuery;
    var filteredDriverRows = (0, react_1.useMemo)(function () {
        var normalizedQuery = searchQuery.trim().toLowerCase();
        return data.drivers.filter(function (row) {
            var _a, _b, _c, _d, _e, _f;
            var matchesStatus = statusFilter === "all" || row.status === statusFilter;
            if (!matchesStatus)
                return false;
            if (!normalizedQuery)
                return true;
            return (String(row.driverId).toLowerCase().includes(normalizedQuery) ||
                row.driverCode.toLowerCase().includes(normalizedQuery) ||
                "".concat(row.firstName, " ").concat(row.lastName).toLowerCase().includes(normalizedQuery) ||
                String((_a = row.tricycleId) !== null && _a !== void 0 ? _a : "").toLowerCase().includes(normalizedQuery) ||
                ((_c = (_b = row.tricycleNo) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(normalizedQuery)) !== null && _c !== void 0 ? _c : false) ||
                String((_d = row.qrId) !== null && _d !== void 0 ? _d : "").toLowerCase().includes(normalizedQuery) ||
                row.todaName.toLowerCase().includes(normalizedQuery) ||
                row.barangayName.toLowerCase().includes(normalizedQuery) ||
                ((_f = (_e = row.contactNo) === null || _e === void 0 ? void 0 : _e.toLowerCase().includes(normalizedQuery)) !== null && _f !== void 0 ? _f : false) ||
                (row.passwordSet ? "password set" : "password pending").includes(normalizedQuery) ||
                row.status.toLowerCase().includes(normalizedQuery));
        });
    }, [data.drivers, searchQuery, statusFilter]);
    var filteredTricycleRows = (0, react_1.useMemo)(function () {
        var normalizedQuery = searchQuery.trim().toLowerCase();
        return data.tricycles.filter(function (row) {
            var _a, _b;
            var matchesStatus = statusFilter === "all" || row.status === statusFilter;
            if (!matchesStatus)
                return false;
            if (!normalizedQuery)
                return true;
            return (formatTricycleCode(row.tricycleId).toLowerCase().includes(normalizedQuery) ||
                String(row.tricycleId).toLowerCase().includes(normalizedQuery) ||
                row.plateNo.toLowerCase().includes(normalizedQuery) ||
                ((_b = (_a = row.regNo) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(normalizedQuery)) !== null && _b !== void 0 ? _b : false) ||
                row.todaName.toLowerCase().includes(normalizedQuery) ||
                row.barangayName.toLowerCase().includes(normalizedQuery) ||
                row.status.toLowerCase().includes(normalizedQuery));
        });
    }, [data.tricycles, searchQuery, statusFilter]);
    var tricycleOptions = (0, react_1.useMemo)(function () { return data.tricycles; }, [data.tricycles]);
    var selectedDriverTripHistory = (0, react_1.useMemo)(function () {
        if (!selectedDriverDetails)
            return [];
        return driverTrips
            .filter(function (trip) {
            return trip.driverId === selectedDriverDetails.driverId &&
                trip.tripStatus === "completed" &&
                Boolean(trip.tripEnd);
        })
            .sort(function (a, b) { return new Date(b.tripStart).getTime() - new Date(a.tripStart).getTime(); });
    }, [driverTrips, selectedDriverDetails]);
    var selectedDriverReportHistory = (0, react_1.useMemo)(function () {
        if (!selectedDriverDetails)
            return [];
        return driverReports
            .filter(function (report) { return report.driverId === selectedDriverDetails.driverId; })
            .sort(function (a, b) { return new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime(); });
    }, [driverReports, selectedDriverDetails]);
    var selectedDriverReportUrl = (0, react_1.useMemo)(function () { return buildPassengerReportUrl(selectedDriverDetails === null || selectedDriverDetails === void 0 ? void 0 : selectedDriverDetails.reportPath); }, [selectedDriverDetails === null || selectedDriverDetails === void 0 ? void 0 : selectedDriverDetails.reportPath]);
    (0, react_1.useEffect)(function () {
        var cancelled = false;
        if (!(selectedDriverDetails === null || selectedDriverDetails === void 0 ? void 0 : selectedDriverDetails.reportPath) || !selectedDriverReportUrl) {
            setQrPreviewDataUrl(null);
            return function () {
                cancelled = true;
            };
        }
        void qrcode_1.default.toDataURL(selectedDriverReportUrl, {
            width: 320,
            margin: 1,
            errorCorrectionLevel: "M"
        })
            .then(function (dataUrl) {
            if (!cancelled) {
                setQrPreviewDataUrl(dataUrl);
            }
        })
            .catch(function () {
            if (!cancelled) {
                setQrPreviewDataUrl(null);
            }
        });
        return function () {
            cancelled = true;
        };
    }, [selectedDriverDetails === null || selectedDriverDetails === void 0 ? void 0 : selectedDriverDetails.reportPath, selectedDriverReportUrl]);
    var resetFeedback = function () {
        setError(null);
        setNotice(null);
    };
    var closeModal = function () {
        setIsModalOpen(false);
        setSelectedDriver(null);
        setSelectedTricycle(null);
        setDriverForm(createInitialDriverForm());
        setTricycleForm(createInitialTricycleForm());
    };
    var closeDeleteDialog = function () {
        setPendingDelete(null);
    };
    var closeDriverDetailsModal = function () {
        setSelectedDriverDetails(null);
    };
    var openCreateModal = function () {
        resetFeedback();
        setModalMode("create");
        setSelectedDriver(null);
        setSelectedTricycle(null);
        setDriverForm(createInitialDriverForm());
        setTricycleForm(createInitialTricycleForm());
        setIsModalOpen(true);
    };
    var openDriverEditModal = function (row) {
        var _a;
        resetFeedback();
        setModalMode("edit");
        setSelectedDriver(row);
        setDriverForm({
            firstName: row.firstName,
            lastName: row.lastName,
            contactNo: (_a = row.contactNo) !== null && _a !== void 0 ? _a : "",
            tricycleId: row.tricycleId ? String(row.tricycleId) : "",
            status: row.status
        });
        setIsModalOpen(true);
    };
    var openDriverDetailsModal = function (row) {
        setSelectedDriverDetails(row);
    };
    var openTricycleEditModal = function (row) {
        var _a;
        resetFeedback();
        setModalMode("edit");
        setSelectedTricycle(row);
        setTricycleForm({
            plateNo: row.plateNo,
            regNo: (_a = row.regNo) !== null && _a !== void 0 ? _a : "",
            permitExpirationDate: toDateInputValue(row.permitExpirationDate),
            status: row.status
        });
        setIsModalOpen(true);
    };
    var handleDriverSubmit = function () { return __awaiter(_this, void 0, void 0, function () {
        var busyAction, created, submitError_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!lockedTodaId) {
                        setError("This TODA admin account is missing an assigned TODA.");
                        return [2 /*return*/];
                    }
                    busyAction = modalMode === "create" ? "create-driver" : "save-driver-".concat(selectedDriver === null || selectedDriver === void 0 ? void 0 : selectedDriver.driverId);
                    setBusyKey(busyAction);
                    setError(null);
                    setNotice(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 9, 10, 11]);
                    if (!(modalMode === "create")) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, superadmin_api_1.createMasterDataItem)(accessToken, "driver", {
                            todaId: lockedTodaId,
                            tricycleId: driverForm.tricycleId ? Number(driverForm.tricycleId) : undefined,
                            firstName: driverForm.firstName,
                            lastName: driverForm.lastName,
                            contactNo: driverForm.contactNo || undefined
                        })];
                case 2:
                    created = _a.sent();
                    if (!(driverForm.status !== "active")) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, superadmin_api_1.updateMasterDataItem)(accessToken, "driver", created.driverId, {
                            status: driverForm.status
                        })];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    setNotice("Added driver ".concat(driverForm.firstName, " ").concat(driverForm.lastName, "."));
                    return [3 /*break*/, 7];
                case 5:
                    if (!selectedDriver) return [3 /*break*/, 7];
                    return [4 /*yield*/, (0, superadmin_api_1.updateMasterDataItem)(accessToken, "driver", selectedDriver.driverId, {
                            todaId: lockedTodaId,
                            tricycleId: driverForm.tricycleId ? Number(driverForm.tricycleId) : null,
                            firstName: driverForm.firstName,
                            lastName: driverForm.lastName,
                            contactNo: driverForm.contactNo || null,
                            status: driverForm.status
                        })];
                case 6:
                    _a.sent();
                    setNotice("Updated driver ".concat(driverForm.firstName, " ").concat(driverForm.lastName, "."));
                    _a.label = 7;
                case 7: return [4 /*yield*/, loadMasterData()];
                case 8:
                    _a.sent();
                    onDataChanged === null || onDataChanged === void 0 ? void 0 : onDataChanged();
                    closeModal();
                    return [3 /*break*/, 11];
                case 9:
                    submitError_1 = _a.sent();
                    setError(String(submitError_1));
                    return [3 /*break*/, 11];
                case 10:
                    setBusyKey(null);
                    return [7 /*endfinally*/];
                case 11: return [2 /*return*/];
            }
        });
    }); };
    var handleTricycleSubmit = function () { return __awaiter(_this, void 0, void 0, function () {
        var busyAction, created, submitError_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!lockedTodaId) {
                        setError("This TODA admin account is missing an assigned TODA.");
                        return [2 /*return*/];
                    }
                    busyAction = modalMode === "create" ? "create-tricycle" : "save-tricycle-".concat(selectedTricycle === null || selectedTricycle === void 0 ? void 0 : selectedTricycle.tricycleId);
                    setBusyKey(busyAction);
                    setError(null);
                    setNotice(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 9, 10, 11]);
                    if (!(modalMode === "create")) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, superadmin_api_1.createMasterDataItem)(accessToken, "tricycle", {
                            todaId: lockedTodaId,
                            plateNo: tricycleForm.plateNo,
                            regNo: tricycleForm.regNo || undefined,
                            permitExpirationDate: tricycleForm.permitExpirationDate || undefined
                        })];
                case 2:
                    created = _a.sent();
                    if (!(tricycleForm.status !== "active")) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, superadmin_api_1.updateMasterDataItem)(accessToken, "tricycle", created.tricycleId, {
                            status: tricycleForm.status
                        })];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    setNotice("Added tricycle ".concat(tricycleForm.plateNo, "."));
                    return [3 /*break*/, 7];
                case 5:
                    if (!selectedTricycle) return [3 /*break*/, 7];
                    return [4 /*yield*/, (0, superadmin_api_1.updateMasterDataItem)(accessToken, "tricycle", selectedTricycle.tricycleId, {
                            todaId: lockedTodaId,
                            plateNo: tricycleForm.plateNo,
                            regNo: tricycleForm.regNo || null,
                            permitExpirationDate: tricycleForm.permitExpirationDate || null,
                            status: tricycleForm.status
                        })];
                case 6:
                    _a.sent();
                    setNotice("Updated tricycle ".concat(tricycleForm.plateNo, "."));
                    _a.label = 7;
                case 7: return [4 /*yield*/, loadMasterData()];
                case 8:
                    _a.sent();
                    onDataChanged === null || onDataChanged === void 0 ? void 0 : onDataChanged();
                    closeModal();
                    return [3 /*break*/, 11];
                case 9:
                    submitError_2 = _a.sent();
                    setError(String(submitError_2));
                    return [3 /*break*/, 11];
                case 10:
                    setBusyKey(null);
                    return [7 /*endfinally*/];
                case 11: return [2 /*return*/];
            }
        });
    }); };
    var openDeleteDriverDialog = function (row) {
        setPendingDelete({
            entity: "driver",
            id: row.driverId,
            driver: row,
            title: "Delete driver ".concat(row.firstName, " ").concat(row.lastName, "?"),
            description: "The driver record will be permanently removed from this TODA page.",
            confirmLabel: "Delete Driver"
        });
    };
    var openDeleteTricycleDialog = function (row) {
        setPendingDelete({
            entity: "tricycle",
            id: row.tricycleId,
            title: "Delete tricycle ".concat(row.plateNo, "?"),
            description: "The tricycle record will be permanently removed from this TODA page.",
            confirmLabel: "Delete Tricycle"
        });
    };
    var confirmDelete = function () { return __awaiter(_this, void 0, void 0, function () {
        var deleteKey, deleteError_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!pendingDelete)
                        return [2 /*return*/];
                    deleteKey = "delete-".concat(pendingDelete.entity, "-").concat(pendingDelete.id);
                    setBusyKey(deleteKey);
                    setError(null);
                    setNotice(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, (0, superadmin_api_1.deleteMasterDataItem)(accessToken, pendingDelete.entity, pendingDelete.id)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, loadMasterData()];
                case 3:
                    _a.sent();
                    if (pendingDelete.entity === "driver") {
                        onDriverDeleted === null || onDriverDeleted === void 0 ? void 0 : onDriverDeleted(pendingDelete.driver);
                    }
                    setNotice(pendingDelete.entity === "driver" ? "Deleted driver." : "Deleted tricycle.");
                    closeDeleteDialog();
                    onDataChanged === null || onDataChanged === void 0 ? void 0 : onDataChanged();
                    return [3 /*break*/, 6];
                case 4:
                    deleteError_1 = _a.sent();
                    setError(String(deleteError_1));
                    return [3 /*break*/, 6];
                case 5:
                    setBusyKey(null);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var handleCopyQrLink = function () { return __awaiter(_this, void 0, void 0, function () {
        var copyError_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!selectedDriverReportUrl)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, navigator.clipboard.writeText(selectedDriverReportUrl)];
                case 2:
                    _a.sent();
                    setNotice("Passenger report link copied.");
                    return [3 /*break*/, 4];
                case 3:
                    copyError_1 = _a.sent();
                    setError(String(copyError_1));
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleDownloadQr = function () {
        if (!qrPreviewDataUrl || !selectedDriverDetails)
            return;
        var link = document.createElement("a");
        link.href = qrPreviewDataUrl;
        link.download = "".concat(selectedDriverDetails.driverCode.toLowerCase(), "-report-qr.png");
        link.click();
    };
    var handlePrintQr = function () {
        var _a;
        if (!qrPreviewDataUrl || !selectedDriverDetails || !selectedDriverReportUrl)
            return;
        var printWindow = window.open("", "_blank", "noopener,noreferrer,width=640,height=720");
        if (!printWindow) {
            setError("Unable to open the print preview window.");
            return;
        }
        printWindow.document.write("\n      <html>\n        <head>\n          <title>".concat(selectedDriverDetails.driverCode, " Passenger Reporting QR</title>\n          <style>\n            body { font-family: Arial, sans-serif; padding: 32px; text-align: center; color: #17212b; }\n            img { width: 280px; height: 280px; display: block; margin: 0 auto 20px; }\n            h1 { margin-bottom: 8px; }\n            p { margin: 6px 0; word-break: break-word; }\n          </style>\n        </head>\n        <body>\n          <img src=\"").concat(qrPreviewDataUrl, "\" alt=\"Passenger reporting QR code\" />\n          <h1>").concat(selectedDriverDetails.firstName, " ").concat(selectedDriverDetails.lastName, "</h1>\n          <p>").concat(selectedDriverDetails.driverCode, "</p>\n          <p>").concat((_a = selectedDriverDetails.tricycleNo) !== null && _a !== void 0 ? _a : "No tricycle assigned", "</p>\n          <p>").concat(selectedDriverReportUrl, "</p>\n        </body>\n      </html>\n    "));
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };
    var handleRegenerateDriverQr = function () { return __awaiter(_this, void 0, void 0, function () {
        var busyAction, updated, regenerateError_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!selectedDriverDetails)
                        return [2 /*return*/];
                    busyAction = "regenerate-driver-qr-".concat(selectedDriverDetails.driverId);
                    setBusyKey(busyAction);
                    setError(null);
                    setNotice(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, (0, superadmin_api_1.updateMasterDataItem)(accessToken, "driver", selectedDriverDetails.driverId, { regenerateQr: true })];
                case 2:
                    updated = _a.sent();
                    setSelectedDriverDetails(updated);
                    return [4 /*yield*/, loadMasterData()];
                case 3:
                    _a.sent();
                    onDataChanged === null || onDataChanged === void 0 ? void 0 : onDataChanged();
                    setNotice("Regenerated passenger QR for ".concat(updated.firstName, " ").concat(updated.lastName, "."));
                    return [3 /*break*/, 6];
                case 4:
                    regenerateError_1 = _a.sent();
                    setError(String(regenerateError_1));
                    return [3 /*break*/, 6];
                case 5:
                    setBusyKey(null);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var pageTitle = isDriverPage ? "Drivers" : "Tricycles";
    var searchPlaceholder = isDriverPage
        ? "Search driver ID, name, tricycle, QR..."
        : "Search tricycle ID, plate, registration...";
    var addButtonLabel = isDriverPage ? "Add Driver" : "Add Tricycle";
    var modalBusyKey = isDriverPage
        ? modalMode === "create"
            ? "create-driver"
            : "save-driver-".concat(selectedDriver === null || selectedDriver === void 0 ? void 0 : selectedDriver.driverId)
        : modalMode === "create"
            ? "create-tricycle"
            : "save-tricycle-".concat(selectedTricycle === null || selectedTricycle === void 0 ? void 0 : selectedTricycle.tricycleId);
    return (<section className="fleet-page">
      {(error || notice) && (<div className={"fleet-banner ".concat(error ? "fleet-banner--error" : "")}>
          {error !== null && error !== void 0 ? error : notice}
        </div>)}

      <section className="fleet-toolbar">
        <input className="fleet-toolbar__search" placeholder={searchPlaceholder} value={searchQuery} onChange={function (event) { return setSearchQuery(event.target.value); }} aria-label={searchPlaceholder}/>

        <select className="fleet-toolbar__filter" value={statusFilter} onChange={function (event) { return setStatusFilter(event.target.value); }} aria-label="Filter by status">
          {STATUS_OPTIONS.map(function (status) { return (<option key={status} value={status}>
              {status === "all" ? "All Status" : formatStatusLabel(status)}
            </option>); })}
        </select>

        <button type="button" className="fleet-toolbar__button" onClick={openCreateModal}>
          {addButtonLabel}
        </button>
      </section>

      <section className="fleet-table-card">
        <div className="fleet-table-wrap">
          {loading ? (<div className="fleet-empty">Loading {pageTitle.toLowerCase()}...</div>) : isDriverPage ? (filteredDriverRows.length === 0 ? (<div className="fleet-empty">No drivers found for the current filters.</div>) : (<table className="fleet-table">
                <thead>
                  <tr>
                    <th>Driver ID</th>
                    <th>Name</th>
                    <th>Tricycle</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Password</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDriverRows.map(function (row) {
                var _a, _b;
                return (<tr key={row.driverId} className="fleet-table__row fleet-table__row--interactive" onClick={function () { return openDriverDetailsModal(row); }} onKeyDown={function (event) {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openDriverDetailsModal(row);
                        }
                    }} tabIndex={0} role="button" aria-label={"View details for ".concat(row.firstName, " ").concat(row.lastName)}>
                      <td>{row.driverCode}</td>
                      <td>{row.firstName} {row.lastName}</td>
                      <td>{(_a = row.tricycleNo) !== null && _a !== void 0 ? _a : "Unassigned"}</td>
                      <td>{(_b = row.contactNo) !== null && _b !== void 0 ? _b : "No contact"}</td>
                      <td>
                        <span className={"fleet-status fleet-status--".concat(row.status)}>
                          {formatStatusLabel(row.status)}
                        </span>
                      </td>
                      <td>{row.passwordSet ? "Set" : "Pending"}</td>
                      <td>
                        <div className="fleet-actions">
                          <button type="button" className="fleet-action fleet-action--edit" onClick={function (event) {
                        event.stopPropagation();
                        openDriverEditModal(row);
                    }}>
                            Edit
                          </button>
                          <button type="button" className="fleet-action fleet-action--delete" onClick={function (event) {
                        event.stopPropagation();
                        openDeleteDriverDialog(row);
                    }} disabled={busyKey === "delete-driver-".concat(row.driverId)}>
                            {busyKey === "delete-driver-".concat(row.driverId) ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>);
            })}
                </tbody>
              </table>)) : filteredTricycleRows.length === 0 ? (<div className="fleet-empty">No tricycles found for the current filters.</div>) : (<table className="fleet-table">
              <thead>
                <tr>
                  <th>Unit ID</th>
                  <th>Plate No</th>
                  <th>Reg No</th>
                  <th>Permit Expiry</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTricycleRows.map(function (row) {
                var _a;
                return (<tr key={row.tricycleId}>
                    <td>{formatTricycleCode(row.tricycleId)}</td>
                    <td>{row.plateNo}</td>
                    <td>{(_a = row.regNo) !== null && _a !== void 0 ? _a : "Not set"}</td>
                    <td>{toDateInputValue(row.permitExpirationDate) || "Not set"}</td>
                    <td>
                      <span className={"fleet-status fleet-status--".concat(row.status)}>
                        {formatStatusLabel(row.status)}
                      </span>
                    </td>
                    <td>
                      <div className="fleet-actions">
                        <button type="button" className="fleet-action fleet-action--edit" onClick={function () { return openTricycleEditModal(row); }}>
                          Edit
                        </button>
                        <button type="button" className="fleet-action fleet-action--delete" onClick={function () { return openDeleteTricycleDialog(row); }} disabled={busyKey === "delete-tricycle-".concat(row.tricycleId)}>
                          {busyKey === "delete-tricycle-".concat(row.tricycleId) ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>);
            })}
              </tbody>
            </table>)}
        </div>
      </section>

      {selectedDriverDetails && (<div className="fleet-modal-backdrop" role="presentation" onClick={closeDriverDetailsModal}>
          <div className="fleet-modal fleet-modal--details" role="dialog" aria-modal="true" aria-labelledby="fleet-driver-details-title" onClick={function (event) { return event.stopPropagation(); }}>
            <div className="fleet-modal__header">
              <div>
                <h3 id="fleet-driver-details-title">
                  {selectedDriverDetails.firstName} {selectedDriverDetails.lastName}
                </h3>
                <p>{selectedDriverDetails.driverCode} • {selectedDriverDetails.todaName}</p>
              </div>
              <button type="button" className="fleet-modal__close" onClick={closeDriverDetailsModal}>
                Close
              </button>
            </div>

            <div className="fleet-details">
              <section className="fleet-details__summary">
                <div>
                  <span className="fleet-details__label">Driver Status</span>
                  <span className={"fleet-status fleet-status--".concat(selectedDriverDetails.status)}>
                    {formatStatusLabel(selectedDriverDetails.status)}
                  </span>
                </div>
                <div>
                  <span className="fleet-details__label">Password</span>
                  <strong>{selectedDriverDetails.passwordSet ? "Set" : "Pending"}</strong>
                </div>
                <div>
                  <span className="fleet-details__label">Recent Trips</span>
                  <strong>{selectedDriverTripHistory.length}</strong>
                </div>
                <div>
                  <span className="fleet-details__label">Passenger Reports</span>
                  <strong>{selectedDriverReportHistory.length}</strong>
                </div>
              </section>

              <section className="fleet-details__grid">
                <div className="fleet-details__item">
                  <span className="fleet-details__label">Contact Number</span>
                  <strong>{(_b = selectedDriverDetails.contactNo) !== null && _b !== void 0 ? _b : "No contact provided"}</strong>
                </div>
                <div className="fleet-details__item">
                  <span className="fleet-details__label">Assigned Tricycle</span>
                  <strong>{(_c = selectedDriverDetails.tricycleNo) !== null && _c !== void 0 ? _c : "Unassigned"}</strong>
                </div>
                <div className="fleet-details__item">
                  <span className="fleet-details__label">QR Status</span>
                  <strong>{(_d = selectedDriverDetails.qrStatus) !== null && _d !== void 0 ? _d : "Pending"}</strong>
                </div>
                <div className="fleet-details__item">
                  <span className="fleet-details__label">Barangay</span>
                  <strong>{selectedDriverDetails.barangayName}</strong>
                </div>
                <div className="fleet-details__item">
                  <span className="fleet-details__label">Created</span>
                  <strong>{formatDateTime(selectedDriverDetails.createdAt)}</strong>
                </div>
                <div className="fleet-details__item">
                  <span className="fleet-details__label">QR Issued</span>
                  <strong>{formatDateTime(selectedDriverDetails.qrIssuedAt)}</strong>
                </div>
              </section>

              <section className="fleet-details__section">
                <div className="fleet-details__section-header">
                  <div>
                    <h4>Passenger Reporting QR</h4>
                    <p>This QR stays with the driver record and opens the mobile web reporting page.</p>
                  </div>
                </div>

                {!selectedDriverDetails.qrId || !selectedDriverDetails.reportPath ? (<div className="fleet-details__empty">
                    This driver does not have a passenger reporting QR yet.
                  </div>) : PASSENGER_REPORT_BASE.error ? (<div className="fleet-details__empty fleet-details__empty--error">
                    {PASSENGER_REPORT_BASE.error}
                  </div>) : (<div className="fleet-qr-panel">
                    <div className="fleet-qr-panel__preview">
                      {qrPreviewDataUrl ? (<img src={qrPreviewDataUrl} alt={"Passenger reporting QR for ".concat(selectedDriverDetails.firstName, " ").concat(selectedDriverDetails.lastName)}/>) : (<div className="fleet-details__empty">Generating QR preview...</div>)}
                    </div>

                    <div className="fleet-qr-panel__body">
                      <div className="fleet-details__grid">
                        <div className="fleet-details__item">
                          <span className="fleet-details__label">QR ID</span>
                          <strong>#{selectedDriverDetails.qrId}</strong>
                        </div>
                        <div className="fleet-details__item">
                          <span className="fleet-details__label">Driver Report URL</span>
                          <strong className="fleet-qr-panel__url">
                            {selectedDriverReportUrl || "Unavailable"}
                          </strong>
                        </div>
                      </div>

                      <div className="fleet-qr-panel__actions">
                        <button type="button" className="fleet-action fleet-action--edit" onClick={function () { return void handleCopyQrLink(); }} disabled={!selectedDriverReportUrl}>
                          Copy Link
                        </button>
                        <button type="button" className="fleet-action fleet-action--edit" onClick={handleDownloadQr} disabled={!qrPreviewDataUrl}>
                          Download QR
                        </button>
                        <button type="button" className="fleet-action fleet-action--edit" onClick={handlePrintQr} disabled={!qrPreviewDataUrl}>
                          Print QR
                        </button>
                        <button type="button" className="fleet-action fleet-action--delete" onClick={function () { return void handleRegenerateDriverQr(); }} disabled={busyKey === "regenerate-driver-qr-".concat(selectedDriverDetails.driverId)}>
                          {busyKey === "regenerate-driver-qr-".concat(selectedDriverDetails.driverId)
                    ? "Regenerating..."
                    : "Regenerate QR"}
                        </button>
                      </div>
                    </div>
                  </div>)}
              </section>

              <section className="fleet-details__section">
                <div className="fleet-details__section-header">
                  <div>
                    <h4>Trip History</h4>
                    <p>Showing the latest trips currently available in this dashboard.</p>
                  </div>
                </div>

                {tripHistoryLoading ? (<div className="fleet-details__empty">Loading recent trip history...</div>) : tripHistoryError ? (<div className="fleet-details__empty fleet-details__empty--error">
                    Trip history is unavailable right now.
                  </div>) : selectedDriverTripHistory.length === 0 ? (<div className="fleet-details__empty">No recent trip history for this driver yet.</div>) : (<div className="fleet-trip-history">
                    {selectedDriverTripHistory.map(function (trip) { return (<article key={trip.tripId} className="fleet-trip-card">
                        <div className="fleet-trip-card__top">
                          <div>
                            <strong>{trip.routeName}</strong>
                            <div className="fleet-trip-card__meta">
                              Trip #{trip.tripId} • {trip.plateNo} • {trip.todaName}
                            </div>
                          </div>
                          <span className={"fleet-trip-status fleet-trip-status--".concat(trip.tripStatus)}>
                            {formatTripStatusLabel(trip.tripStatus)}
                          </span>
                        </div>

                        <div className="fleet-trip-card__stats">
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
                            <strong>
                              {trip.durationMinutes !== undefined ? "".concat(trip.durationMinutes, " min") : "Not set"}
                            </strong>
                          </div>
                          <div>
                            <span>Fare</span>
                            <strong>{formatCurrency(trip.fareAmount)}</strong>
                          </div>
                        </div>
                      </article>); })}
                  </div>)}
              </section>

              <section className="fleet-details__section">
                <div className="fleet-details__section-header">
                  <div>
                    <h4>Passenger Reports</h4>
                    <p>Recent browser-submitted reports tied to this driver QR.</p>
                  </div>
                </div>

                {reportHistoryLoading ? (<div className="fleet-details__empty">Loading passenger reports...</div>) : reportHistoryError ? (<div className="fleet-details__empty fleet-details__empty--error">
                    Passenger report history is unavailable right now.
                  </div>) : selectedDriverReportHistory.length === 0 ? (<div className="fleet-details__empty">
                    No passenger reports have been submitted for this driver yet.
                  </div>) : (<div className="fleet-trip-history">
                    {selectedDriverReportHistory.map(function (report) {
                    var _a, _b, _c;
                    return (<article key={report.reportId} className="fleet-trip-card">
                        <div className="fleet-trip-card__top">
                          <div>
                            <strong>{report.reportTypeLabel}</strong>
                            <div className="fleet-trip-card__meta">
                              Report #{report.reportId} • {new Date(report.reportedAt).toLocaleString()}
                            </div>
                          </div>
                          <span className={"fleet-trip-status fleet-trip-status--".concat(report.status)}>
                            {report.status.replace("_", " ")}
                          </span>
                        </div>

                        <div className="fleet-trip-card__stats">
                          <div>
                            <span>Trip</span>
                            <strong>{report.tripId ? "#".concat(report.tripId) : "No trip attached"}</strong>
                          </div>
                          <div>
                            <span>Route</span>
                            <strong>{(_a = report.routeName) !== null && _a !== void 0 ? _a : "No route attached"}</strong>
                          </div>
                          <div>
                            <span>Passenger</span>
                            <strong>{(_b = report.passengerName) !== null && _b !== void 0 ? _b : "Anonymous"}</strong>
                          </div>
                          <div>
                            <span>Contact</span>
                            <strong>{(_c = report.passengerContact) !== null && _c !== void 0 ? _c : "Not provided"}</strong>
                          </div>
                        </div>

                        <div className="fleet-report-card__description">{report.description}</div>
                      </article>);
                })}
                  </div>)}
              </section>
            </div>
          </div>
        </div>)}

      {isModalOpen && (<div className="fleet-modal-backdrop" role="presentation" onClick={closeModal}>
          <div className="fleet-modal" role="dialog" aria-modal="true" aria-labelledby="fleet-modal-title" onClick={function (event) { return event.stopPropagation(); }}>
            <div className="fleet-modal__header">
              <div>
                <h3 id="fleet-modal-title">
                  {modalMode === "create"
                ? isDriverPage
                    ? "Add Driver"
                    : "Add Tricycle"
                : isDriverPage
                    ? "Edit Driver"
                    : "Edit Tricycle"}
                </h3>
                <p>{lockedTodaLabel !== null && lockedTodaLabel !== void 0 ? lockedTodaLabel : "Assigned TODA"}</p>
              </div>
              <button type="button" className="fleet-modal__close" onClick={closeModal}>
                Close
              </button>
            </div>

            {isDriverPage ? (<form className="fleet-form" onSubmit={function (event) {
                    event.preventDefault();
                    void handleDriverSubmit();
                }}>
                <label>
                  <span>First Name</span>
                  <input value={driverForm.firstName} onChange={function (event) {
                    return setDriverForm(function (current) { return (__assign(__assign({}, current), { firstName: event.target.value })); });
                }} required/>
                </label>

                <label>
                  <span>Last Name</span>
                  <input value={driverForm.lastName} onChange={function (event) {
                    return setDriverForm(function (current) { return (__assign(__assign({}, current), { lastName: event.target.value })); });
                }} required/>
                </label>

                <label>
                  <span>Assigned Tricycle</span>
                  <select value={driverForm.tricycleId} onChange={function (event) {
                    return setDriverForm(function (current) { return (__assign(__assign({}, current), { tricycleId: event.target.value })); });
                }}>
                    <option value="">No tricycle</option>
                    {tricycleOptions.map(function (tricycle) { return (<option key={tricycle.tricycleId} value={tricycle.tricycleId}>
                        {tricycle.plateNo}
                      </option>); })}
                  </select>
                </label>

                <label>
                  <span>Passenger Reporting QR</span>
                  <div className="fleet-form__hint">
                    A unique passenger reporting QR will be generated automatically for this driver.
                  </div>
                </label>

                <label>
                  <span>Contact Number</span>
                  <input value={driverForm.contactNo} onChange={function (event) {
                    return setDriverForm(function (current) { return (__assign(__assign({}, current), { contactNo: event.target.value })); });
                }} placeholder="Optional"/>
                </label>

                <label>
                  <span>Status</span>
                  <select value={driverForm.status} onChange={function (event) {
                    return setDriverForm(function (current) { return (__assign(__assign({}, current), { status: event.target.value })); });
                }}>
                    {STATUS_OPTIONS.filter(function (status) { return status !== "all"; }).map(function (status) { return (<option key={status} value={status}>
                        {formatStatusLabel(status)}
                      </option>); })}
                  </select>
                </label>

                <div className="fleet-modal__footer">
                  <button type="button" className="fleet-modal__secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="fleet-modal__primary" disabled={busyKey === modalBusyKey ||
                    !driverForm.firstName.trim() ||
                    !driverForm.lastName.trim()}>
                    {busyKey === modalBusyKey
                    ? "Saving..."
                    : modalMode === "create"
                        ? "Save Driver"
                        : "Update Driver"}
                  </button>
                </div>
              </form>) : (<form className="fleet-form" onSubmit={function (event) {
                    event.preventDefault();
                    void handleTricycleSubmit();
                }}>
                <label>
                  <span>Plate No</span>
                  <input value={tricycleForm.plateNo} onChange={function (event) {
                    return setTricycleForm(function (current) { return (__assign(__assign({}, current), { plateNo: event.target.value })); });
                }} required/>
                </label>

                <label>
                  <span>Registration No</span>
                  <input value={tricycleForm.regNo} onChange={function (event) {
                    return setTricycleForm(function (current) { return (__assign(__assign({}, current), { regNo: event.target.value })); });
                }} placeholder="Optional"/>
                </label>

                <label>
                  <span>Permit Expiration</span>
                  <input type="date" value={tricycleForm.permitExpirationDate} onChange={function (event) {
                    return setTricycleForm(function (current) { return (__assign(__assign({}, current), { permitExpirationDate: event.target.value })); });
                }}/>
                </label>

                <label>
                  <span>Status</span>
                  <select value={tricycleForm.status} onChange={function (event) {
                    return setTricycleForm(function (current) { return (__assign(__assign({}, current), { status: event.target.value })); });
                }}>
                    {STATUS_OPTIONS.filter(function (status) { return status !== "all"; }).map(function (status) { return (<option key={status} value={status}>
                        {formatStatusLabel(status)}
                      </option>); })}
                  </select>
                </label>

                <div className="fleet-modal__footer">
                  <button type="button" className="fleet-modal__secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="fleet-modal__primary" disabled={busyKey === modalBusyKey || !tricycleForm.plateNo.trim()}>
                    {busyKey === modalBusyKey
                    ? "Saving..."
                    : modalMode === "create"
                        ? "Save Tricycle"
                        : "Update Tricycle"}
                  </button>
                </div>
              </form>)}
          </div>
        </div>)}

      <DeleteConfirmDialog_1.default open={pendingDelete !== null} title={(_e = pendingDelete === null || pendingDelete === void 0 ? void 0 : pendingDelete.title) !== null && _e !== void 0 ? _e : ""} description={(_f = pendingDelete === null || pendingDelete === void 0 ? void 0 : pendingDelete.description) !== null && _f !== void 0 ? _f : ""} confirmLabel={(_g = pendingDelete === null || pendingDelete === void 0 ? void 0 : pendingDelete.confirmLabel) !== null && _g !== void 0 ? _g : "Delete"} busy={pendingDelete !== null && busyKey === "delete-".concat(pendingDelete.entity, "-").concat(pendingDelete.id)} onClose={closeDeleteDialog} onConfirm={function () { return void confirmDelete(); }}/>
    </section>);
}
