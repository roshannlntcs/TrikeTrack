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
exports.default = SuperadminPage;
var react_1 = require("react");
var superadmin_api_1 = require("../lib/superadmin-api");
var DeleteConfirmDialog_1 = require("../components/DeleteConfirmDialog");
require("./SuperadminPage.css");
var STATUS_OPTIONS = ["active", "inactive", "suspended"];
var ROLE_OPTIONS = ["superadmin", "barangay_admin", "toda_admin"];
var SETTINGS_TABS = [
    { key: "admin-panel", label: "Admin Panel" },
    { key: "barangays", label: "Barangays" },
    { key: "todas", label: "TODAs" },
    { key: "routes", label: "Routes" },
    { key: "administrators", label: "Administrators" }
];
var RefreshIcon = function () { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a9 9 0 0 1-15.4 6.4"/>
    <path d="M3 12A9 9 0 0 1 18.4 5.6"/>
    <path d="M18 2v4h4"/>
    <path d="M6 22v-4H2"/>
  </svg>); };
var initialMasterData = {
    administrators: [],
    barangays: [],
    todas: [],
    drivers: [],
    tricycles: [],
    routes: []
};
var createBarangayForm = function () { return ({
    barangayName: "",
    district: "",
    city: "Davao City",
    status: "active"
}); };
var createTodaForm = function () { return ({
    barangayId: "",
    todaName: "",
    status: "active"
}); };
var createRouteForm = function () { return ({
    todaId: "",
    origin: "",
    destination: "",
    defaultFareAmount: "",
    geofenceGeojsonText: "",
    status: "active"
}); };
var createAdministratorForm = function () { return ({
    email: "",
    password: "",
    role: "barangay_admin",
    barangayId: "",
    todaId: "",
    status: "active"
}); };
var toDateInputValue = function (value) { return (value ? value.slice(0, 10) : ""); };
var formatStatusLabel = function (status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
};
var formatRoleLabel = function (role) {
    return role
        .split("_")
        .map(function (part) { return part.charAt(0).toUpperCase() + part.slice(1); })
        .join(" ");
};
var formatEntityLabel = function (entity) {
    return entity === "toda"
        ? "TODA"
        : entity === "administrator"
            ? "Administrator"
            : entity.charAt(0).toUpperCase() + entity.slice(1);
};
var formatAdministratorScope = function (row) {
    var _a;
    if (row.role === "superadmin")
        return "System-wide";
    if (row.todaName)
        return "".concat((_a = row.barangayName) !== null && _a !== void 0 ? _a : "Assigned barangay", " / ").concat(row.todaName);
    if (row.barangayName)
        return row.barangayName;
    return "No scope assigned";
};
var formatDateLabel = function (value) {
    return value ? new Date(value).toLocaleDateString() : "Not available";
};
var formatFareLabel = function (value) {
    return typeof value === "number" && Number.isFinite(value)
        ? new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value)
        : "Not set";
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
var isStrongTemporaryPassword = function (value) {
    return value.length >= 8 &&
        /[a-z]/.test(value) &&
        /[A-Z]/.test(value) &&
        /\d/.test(value);
};
function SuperadminPage(_a) {
    var _this = this;
    var _b, _c, _d;
    var accessToken = _a.accessToken, _e = _a.mode, mode = _e === void 0 ? "superadmin" : _e, lockedTodaId = _a.lockedTodaId, lockedTodaLabel = _a.lockedTodaLabel, controlledSearchQuery = _a.searchQuery, onSearchPlaceholderChange = _a.onSearchPlaceholderChange, onDataChanged = _a.onDataChanged;
    var isTodaAdminMode = mode === "toda-admin";
    var _f = (0, react_1.useState)("admin-panel"), activeTab = _f[0], setActiveTab = _f[1];
    var _g = (0, react_1.useState)(initialMasterData), data = _g[0], setData = _g[1];
    var _h = (0, react_1.useState)(true), loading = _h[0], setLoading = _h[1];
    var _j = (0, react_1.useState)(null), error = _j[0], setError = _j[1];
    var _k = (0, react_1.useState)(null), notice = _k[0], setNotice = _k[1];
    var _l = (0, react_1.useState)(null), busyKey = _l[0], setBusyKey = _l[1];
    var _m = (0, react_1.useState)(null), activeModal = _m[0], setActiveModal = _m[1];
    var _o = (0, react_1.useState)(null), pendingDelete = _o[0], setPendingDelete = _o[1];
    var _p = (0, react_1.useState)(createBarangayForm), barangayForm = _p[0], setBarangayForm = _p[1];
    var _q = (0, react_1.useState)(createTodaForm), todaForm = _q[0], setTodaForm = _q[1];
    var _r = (0, react_1.useState)(createRouteForm), routeForm = _r[0], setRouteForm = _r[1];
    var _s = (0, react_1.useState)(createAdministratorForm), administratorForm = _s[0], setAdministratorForm = _s[1];
    var _t = (0, react_1.useState)({
        todaId: lockedTodaId ? String(lockedTodaId) : "",
        tricycleId: "",
        qrId: "",
        firstName: "",
        lastName: "",
        contactNo: ""
    }), driverForm = _t[0], setDriverForm = _t[1];
    var _u = (0, react_1.useState)({
        todaId: lockedTodaId ? String(lockedTodaId) : "",
        plateNo: "",
        regNo: "",
        permitExpirationDate: ""
    }), tricycleForm = _u[0], setTricycleForm = _u[1];
    var loadMasterData = function () { return __awaiter(_this, void 0, void 0, function () {
        var snapshot, loadError_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, superadmin_api_1.fetchMasterData)(accessToken)];
                case 2:
                    snapshot = _a.sent();
                    setData(snapshot);
                    setError(null);
                    return [3 /*break*/, 5];
                case 3:
                    loadError_1 = _a.sent();
                    setError(String(loadError_1));
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    (0, react_1.useEffect)(function () {
        void loadMasterData();
    }, [accessToken]);
    (0, react_1.useEffect)(function () {
        if (!isTodaAdminMode || !lockedTodaId)
            return;
        setDriverForm(function (current) { return (__assign(__assign({}, current), { todaId: String(lockedTodaId) })); });
        setTricycleForm(function (current) { return (__assign(__assign({}, current), { todaId: String(lockedTodaId) })); });
    }, [isTodaAdminMode, lockedTodaId]);
    (0, react_1.useEffect)(function () {
        if (isTodaAdminMode) {
            onSearchPlaceholderChange === null || onSearchPlaceholderChange === void 0 ? void 0 : onSearchPlaceholderChange("Search driver ID, tricycle ID, plate...");
            return;
        }
        var placeholder = activeTab === "admin-panel"
            ? "Search admins, barangays, TODAs, routes..."
            : activeTab === "barangays"
                ? "Search barangay ID, name, district, city..."
                : activeTab === "todas"
                    ? "Search TODA ID, name, barangay..."
                    : activeTab === "routes"
                        ? "Search route ID, TODA, origin, destination..."
                        : "Search admin ID, email, role, scope...";
        onSearchPlaceholderChange === null || onSearchPlaceholderChange === void 0 ? void 0 : onSearchPlaceholderChange(placeholder);
    }, [activeTab, isTodaAdminMode, onSearchPlaceholderChange]);
    var searchQuery = controlledSearchQuery !== null && controlledSearchQuery !== void 0 ? controlledSearchQuery : "";
    var normalizedSearchQuery = searchQuery.trim().toLowerCase();
    var hasSearchQuery = normalizedSearchQuery.length > 0;
    var todaOptions = (0, react_1.useMemo)(function () { return data.todas; }, [data.todas]);
    var barangayOptions = (0, react_1.useMemo)(function () { return data.barangays; }, [data.barangays]);
    var tricycleOptions = (0, react_1.useMemo)(function () { return data.tricycles; }, [data.tricycles]);
    var recentActivity = (0, react_1.useMemo)(function () {
        var items = __spreadArray(__spreadArray(__spreadArray(__spreadArray([], data.administrators.map(function (row) { return ({
            key: "administrator-".concat(row.adminId),
            category: "Administrator",
            title: row.email,
            scope: formatAdministratorScope(row),
            status: row.status,
            createdAt: row.createdAt
        }); }), true), data.barangays.map(function (row) { return ({
            key: "barangay-".concat(row.barangayId),
            category: "Barangay",
            title: row.barangayName,
            scope: row.city,
            status: row.status,
            createdAt: row.createdAt
        }); }), true), data.todas.map(function (row) { return ({
            key: "toda-".concat(row.todaId),
            category: "TODA",
            title: row.todaName,
            scope: row.barangayName,
            status: row.status,
            createdAt: row.createdAt
        }); }), true), data.routes.map(function (row) { return ({
            key: "route-".concat(row.routeId),
            category: "Route",
            title: "".concat(row.origin, " -> ").concat(row.destination),
            scope: "".concat(row.barangayName, " / ").concat(row.todaName),
            status: row.status,
            createdAt: row.createdAt
        }); }), true);
        return items
            .sort(function (a, b) { return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); })
            .slice(0, 8);
    }, [data.administrators, data.barangays, data.routes, data.todas]);
    var filteredRecentActivity = (0, react_1.useMemo)(function () {
        if (!hasSearchQuery)
            return recentActivity;
        return recentActivity.filter(function (item) {
            return textMatchesSearch(normalizedSearchQuery, item.key, item.category, item.title, item.scope, item.status, item.createdAt);
        });
    }, [hasSearchQuery, normalizedSearchQuery, recentActivity]);
    var filteredBarangays = (0, react_1.useMemo)(function () {
        if (!hasSearchQuery)
            return data.barangays;
        return data.barangays.filter(function (row) {
            return textMatchesSearch(normalizedSearchQuery, row.barangayId, row.barangayName, row.district, row.city, row.status, row.todaCount, row.createdAt);
        });
    }, [data.barangays, hasSearchQuery, normalizedSearchQuery]);
    var filteredTodas = (0, react_1.useMemo)(function () {
        if (!hasSearchQuery)
            return data.todas;
        return data.todas.filter(function (row) {
            return textMatchesSearch(normalizedSearchQuery, row.todaId, row.todaName, row.barangayId, row.barangayName, row.status, row.driverCount, row.tricycleCount, row.createdAt);
        });
    }, [data.todas, hasSearchQuery, normalizedSearchQuery]);
    var filteredRoutes = (0, react_1.useMemo)(function () {
        if (!hasSearchQuery)
            return data.routes;
        return data.routes.filter(function (row) {
            return textMatchesSearch(normalizedSearchQuery, row.routeId, row.origin, row.destination, row.defaultFareAmount, row.todaId, row.todaName, row.barangayName, row.status, row.createdAt);
        });
    }, [data.routes, hasSearchQuery, normalizedSearchQuery]);
    var filteredAdministrators = (0, react_1.useMemo)(function () {
        if (!hasSearchQuery)
            return data.administrators;
        return data.administrators.filter(function (row) {
            return textMatchesSearch(normalizedSearchQuery, row.adminId, row.email, row.role, formatAdministratorScope(row), row.status, row.barangayId, row.barangayName, row.todaId, row.todaName, row.city, row.createdAt);
        });
    }, [data.administrators, hasSearchQuery, normalizedSearchQuery]);
    var filteredDrivers = (0, react_1.useMemo)(function () {
        if (!hasSearchQuery)
            return data.drivers;
        return data.drivers.filter(function (row) {
            return textMatchesSearch(normalizedSearchQuery, row.driverId, row.driverCode, "".concat(row.firstName, " ").concat(row.lastName), row.firstName, row.lastName, row.contactNo, row.tricycleId, row.tricycleNo, row.qrId, row.qrStatus, row.todaId, row.todaName, row.barangayName, row.passwordSet ? "password set" : "password pending", row.status, row.createdAt);
        });
    }, [data.drivers, hasSearchQuery, normalizedSearchQuery]);
    var filteredTricycles = (0, react_1.useMemo)(function () {
        if (!hasSearchQuery)
            return data.tricycles;
        return data.tricycles.filter(function (row) {
            return textMatchesSearch(normalizedSearchQuery, row.tricycleId, row.plateNo, row.regNo, row.permitExpirationDate, row.todaId, row.todaName, row.barangayName, row.status, row.createdAt);
        });
    }, [data.tricycles, hasSearchQuery, normalizedSearchQuery]);
    var totalRecordsManaged = data.administrators.length +
        data.barangays.length +
        data.todas.length +
        data.drivers.length +
        data.tricycles.length +
        data.routes.length;
    var resetNotice = function () {
        setNotice(null);
        setError(null);
    };
    var closeModal = function () {
        setActiveModal(null);
    };
    var closeDeleteDialog = function () {
        setPendingDelete(null);
    };
    var withBusyState = function (key, action) { return __awaiter(_this, void 0, void 0, function () {
        var actionError_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setBusyKey(key);
                    setNotice(null);
                    setError(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, action()];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 3:
                    actionError_1 = _a.sent();
                    setError(String(actionError_1));
                    return [3 /*break*/, 5];
                case 4:
                    setBusyKey(null);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var openBarangayCreateModal = function () {
        resetNotice();
        setBarangayForm(createBarangayForm());
        setActiveModal({ entity: "barangay", mode: "create" });
    };
    var openBarangayEditModal = function (row) {
        var _a;
        resetNotice();
        setBarangayForm({
            barangayName: row.barangayName,
            district: (_a = row.district) !== null && _a !== void 0 ? _a : "",
            city: row.city,
            status: row.status
        });
        setActiveModal({ entity: "barangay", mode: "edit", id: row.barangayId });
    };
    var openTodaCreateModal = function () {
        resetNotice();
        setTodaForm(createTodaForm());
        setActiveModal({ entity: "toda", mode: "create" });
    };
    var openTodaEditModal = function (row) {
        resetNotice();
        setTodaForm({
            barangayId: String(row.barangayId),
            todaName: row.todaName,
            status: row.status
        });
        setActiveModal({ entity: "toda", mode: "edit", id: row.todaId });
    };
    var openRouteCreateModal = function () {
        resetNotice();
        setRouteForm(createRouteForm());
        setActiveModal({ entity: "route", mode: "create" });
    };
    var openRouteEditModal = function (row) {
        resetNotice();
        setRouteForm({
            todaId: String(row.todaId),
            origin: row.origin,
            destination: row.destination,
            defaultFareAmount: row.defaultFareAmount === undefined ? "" : String(row.defaultFareAmount),
            geofenceGeojsonText: row.geofenceGeojson
                ? JSON.stringify(row.geofenceGeojson, null, 2)
                : "",
            status: row.status
        });
        setActiveModal({ entity: "route", mode: "edit", id: row.routeId });
    };
    var openAdministratorCreateModal = function () {
        resetNotice();
        setAdministratorForm(createAdministratorForm());
        setActiveModal({ entity: "administrator", mode: "create" });
    };
    var openAdministratorEditModal = function (row) {
        resetNotice();
        setAdministratorForm({
            adminId: row.adminId,
            email: row.email,
            password: "",
            role: row.role,
            barangayId: row.barangayId ? String(row.barangayId) : "",
            todaId: row.todaId ? String(row.todaId) : "",
            status: row.status
        });
        setActiveModal({ entity: "administrator", mode: "edit", id: row.adminId });
    };
    var openDeleteAdministratorDialog = function (row) {
        setPendingDelete({
            entity: "administrator",
            id: row.adminId,
            title: "Delete admin access for ".concat(row.email, "?"),
            description: "This removes the dashboard administrator access link. The Supabase Auth user login remains available unless it is removed separately in Supabase.",
            confirmLabel: "Delete Admin"
        });
    };
    var handleCreateDriver = function () { return __awaiter(_this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, withBusyState("create-driver", function () { return __awaiter(_this, void 0, void 0, function () {
                        var item;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, (0, superadmin_api_1.createMasterDataItem)(accessToken, "driver", {
                                        todaId: Number(driverForm.todaId),
                                        tricycleId: driverForm.tricycleId ? Number(driverForm.tricycleId) : undefined,
                                        qrId: driverForm.qrId ? Number(driverForm.qrId) : undefined,
                                        firstName: driverForm.firstName,
                                        lastName: driverForm.lastName,
                                        contactNo: driverForm.contactNo || undefined
                                    })];
                                case 1:
                                    item = _a.sent();
                                    return [4 /*yield*/, loadMasterData()];
                                case 2:
                                    _a.sent();
                                    setDriverForm({
                                        todaId: lockedTodaId ? String(lockedTodaId) : driverForm.todaId,
                                        tricycleId: "",
                                        qrId: "",
                                        firstName: "",
                                        lastName: "",
                                        contactNo: ""
                                    });
                                    setNotice("Added driver ".concat(item.firstName, " ").concat(item.lastName, "."));
                                    onDataChanged === null || onDataChanged === void 0 ? void 0 : onDataChanged();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var handleCreateTricycle = function () { return __awaiter(_this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, withBusyState("create-tricycle", function () { return __awaiter(_this, void 0, void 0, function () {
                        var item;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, (0, superadmin_api_1.createMasterDataItem)(accessToken, "tricycle", {
                                        todaId: Number(tricycleForm.todaId),
                                        plateNo: tricycleForm.plateNo,
                                        regNo: tricycleForm.regNo || undefined,
                                        permitExpirationDate: tricycleForm.permitExpirationDate || undefined
                                    })];
                                case 1:
                                    item = _a.sent();
                                    return [4 /*yield*/, loadMasterData()];
                                case 2:
                                    _a.sent();
                                    setTricycleForm({
                                        todaId: lockedTodaId ? String(lockedTodaId) : tricycleForm.todaId,
                                        plateNo: "",
                                        regNo: "",
                                        permitExpirationDate: ""
                                    });
                                    setNotice("Added tricycle ".concat(item.plateNo, "."));
                                    onDataChanged === null || onDataChanged === void 0 ? void 0 : onDataChanged();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var submitSuperadminModal = function () { return __awaiter(_this, void 0, void 0, function () {
        var isCreate_1, nextBusyKey, isCreate_2, nextBusyKey, isCreate_3, nextBusyKey, isCreate_4, nextBusyKey;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!activeModal)
                        return [2 /*return*/];
                    if (!(activeModal.entity === "administrator")) return [3 /*break*/, 2];
                    isCreate_1 = activeModal.mode === "create";
                    nextBusyKey = isCreate_1 ? "create-administrator" : "save-administrator-".concat(activeModal.id);
                    return [4 /*yield*/, withBusyState(nextBusyKey, function () { return __awaiter(_this, void 0, void 0, function () {
                            var payload, item, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        payload = {
                                            email: administratorForm.email.trim(),
                                            password: administratorForm.password.trim() || undefined,
                                            role: administratorForm.role,
                                            barangayId: administratorForm.role === "barangay_admin"
                                                ? Number(administratorForm.barangayId)
                                                : null,
                                            todaId: administratorForm.role === "toda_admin"
                                                ? Number(administratorForm.todaId)
                                                : null,
                                            status: administratorForm.status
                                        };
                                        if (!isCreate_1) return [3 /*break*/, 2];
                                        return [4 /*yield*/, (0, superadmin_api_1.createMasterDataItem)(accessToken, "administrator", payload)];
                                    case 1:
                                        _a = _b.sent();
                                        return [3 /*break*/, 4];
                                    case 2: return [4 /*yield*/, (0, superadmin_api_1.updateMasterDataItem)(accessToken, "administrator", activeModal.id, payload)];
                                    case 3:
                                        _a = _b.sent();
                                        _b.label = 4;
                                    case 4:
                                        item = _a;
                                        return [4 /*yield*/, loadMasterData()];
                                    case 5:
                                        _b.sent();
                                        setNotice("".concat(isCreate_1 ? "Added" : "Updated", " administrator ").concat(item.email, "."));
                                        closeModal();
                                        onDataChanged === null || onDataChanged === void 0 ? void 0 : onDataChanged();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2:
                    if (!(activeModal.entity === "barangay")) return [3 /*break*/, 4];
                    isCreate_2 = activeModal.mode === "create";
                    nextBusyKey = isCreate_2 ? "create-barangay" : "save-barangay-".concat(activeModal.id);
                    return [4 /*yield*/, withBusyState(nextBusyKey, function () { return __awaiter(_this, void 0, void 0, function () {
                            var item, item;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!isCreate_2) return [3 /*break*/, 3];
                                        return [4 /*yield*/, (0, superadmin_api_1.createMasterDataItem)(accessToken, "barangay", {
                                                barangayName: barangayForm.barangayName,
                                                district: barangayForm.district || undefined,
                                                city: barangayForm.city
                                            })];
                                    case 1:
                                        item = _a.sent();
                                        return [4 /*yield*/, loadMasterData()];
                                    case 2:
                                        _a.sent();
                                        setNotice("Added barangay ".concat(item.barangayName, "."));
                                        return [3 /*break*/, 6];
                                    case 3: return [4 /*yield*/, (0, superadmin_api_1.updateMasterDataItem)(accessToken, "barangay", activeModal.id, {
                                            barangayName: barangayForm.barangayName,
                                            district: barangayForm.district || undefined,
                                            city: barangayForm.city,
                                            status: barangayForm.status
                                        })];
                                    case 4:
                                        item = _a.sent();
                                        return [4 /*yield*/, loadMasterData()];
                                    case 5:
                                        _a.sent();
                                        setNotice("Updated barangay ".concat(item.barangayName, "."));
                                        _a.label = 6;
                                    case 6:
                                        closeModal();
                                        onDataChanged === null || onDataChanged === void 0 ? void 0 : onDataChanged();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
                case 4:
                    if (!(activeModal.entity === "toda")) return [3 /*break*/, 6];
                    isCreate_3 = activeModal.mode === "create";
                    nextBusyKey = isCreate_3 ? "create-toda" : "save-toda-".concat(activeModal.id);
                    return [4 /*yield*/, withBusyState(nextBusyKey, function () { return __awaiter(_this, void 0, void 0, function () {
                            var item, item;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!isCreate_3) return [3 /*break*/, 3];
                                        return [4 /*yield*/, (0, superadmin_api_1.createMasterDataItem)(accessToken, "toda", {
                                                barangayId: Number(todaForm.barangayId),
                                                todaName: todaForm.todaName
                                            })];
                                    case 1:
                                        item = _a.sent();
                                        return [4 /*yield*/, loadMasterData()];
                                    case 2:
                                        _a.sent();
                                        setNotice("Added TODA ".concat(item.todaName, "."));
                                        return [3 /*break*/, 6];
                                    case 3: return [4 /*yield*/, (0, superadmin_api_1.updateMasterDataItem)(accessToken, "toda", activeModal.id, {
                                            barangayId: Number(todaForm.barangayId),
                                            todaName: todaForm.todaName,
                                            status: todaForm.status
                                        })];
                                    case 4:
                                        item = _a.sent();
                                        return [4 /*yield*/, loadMasterData()];
                                    case 5:
                                        _a.sent();
                                        setNotice("Updated TODA ".concat(item.todaName, "."));
                                        _a.label = 6;
                                    case 6:
                                        closeModal();
                                        onDataChanged === null || onDataChanged === void 0 ? void 0 : onDataChanged();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
                case 6:
                    if (!(activeModal.entity === "route")) return [3 /*break*/, 8];
                    isCreate_4 = activeModal.mode === "create";
                    nextBusyKey = isCreate_4 ? "create-route" : "save-route-".concat(activeModal.id);
                    return [4 /*yield*/, withBusyState(nextBusyKey, function () { return __awaiter(_this, void 0, void 0, function () {
                            var hasGeofenceText, parsedGeofence, item, item;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        hasGeofenceText = routeForm.geofenceGeojsonText.trim().length > 0;
                                        parsedGeofence = hasGeofenceText
                                            ? JSON.parse(routeForm.geofenceGeojsonText)
                                            : isCreate_4
                                                ? undefined
                                                : null;
                                        if (!isCreate_4) return [3 /*break*/, 3];
                                        return [4 /*yield*/, (0, superadmin_api_1.createMasterDataItem)(accessToken, "route", {
                                                todaId: Number(routeForm.todaId),
                                                origin: routeForm.origin,
                                                destination: routeForm.destination,
                                                defaultFareAmount: routeForm.defaultFareAmount.trim()
                                                    ? Number(routeForm.defaultFareAmount)
                                                    : null,
                                                geofenceGeojson: parsedGeofence
                                            })];
                                    case 1:
                                        item = _a.sent();
                                        return [4 /*yield*/, loadMasterData()];
                                    case 2:
                                        _a.sent();
                                        setNotice("Added route ".concat(item.origin, " -> ").concat(item.destination, "."));
                                        return [3 /*break*/, 6];
                                    case 3: return [4 /*yield*/, (0, superadmin_api_1.updateMasterDataItem)(accessToken, "route", activeModal.id, {
                                            todaId: Number(routeForm.todaId),
                                            origin: routeForm.origin,
                                            destination: routeForm.destination,
                                            defaultFareAmount: routeForm.defaultFareAmount.trim()
                                                ? Number(routeForm.defaultFareAmount)
                                                : null,
                                            geofenceGeojson: parsedGeofence,
                                            status: routeForm.status
                                        })];
                                    case 4:
                                        item = _a.sent();
                                        return [4 /*yield*/, loadMasterData()];
                                    case 5:
                                        _a.sent();
                                        setNotice("Updated route ".concat(item.origin, " -> ").concat(item.destination, "."));
                                        _a.label = 6;
                                    case 6:
                                        closeModal();
                                        onDataChanged === null || onDataChanged === void 0 ? void 0 : onDataChanged();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 7:
                    _a.sent();
                    _a.label = 8;
                case 8: return [2 /*return*/];
            }
        });
    }); };
    var openDeleteBarangayDialog = function (row) {
        setPendingDelete({
            entity: "barangay",
            id: row.barangayId,
            title: "Delete barangay ".concat(row.barangayName, "?"),
            description: "The barangay record will be permanently removed from settings.",
            confirmLabel: "Delete Barangay"
        });
    };
    var openDeleteTodaDialog = function (row) {
        setPendingDelete({
            entity: "toda",
            id: row.todaId,
            title: "Delete TODA ".concat(row.todaName, "?"),
            description: "The TODA record will be permanently removed from settings.",
            confirmLabel: "Delete TODA"
        });
    };
    var openDeleteRouteDialog = function (row) {
        setPendingDelete({
            entity: "route",
            id: row.routeId,
            title: "Delete route ".concat(row.origin, " -> ").concat(row.destination, "?"),
            description: "The route will be permanently removed from settings.",
            confirmLabel: "Delete Route"
        });
    };
    var confirmDelete = function () { return __awaiter(_this, void 0, void 0, function () {
        var deleteKey;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!pendingDelete)
                        return [2 /*return*/];
                    deleteKey = "delete-".concat(pendingDelete.entity, "-").concat(pendingDelete.id);
                    return [4 /*yield*/, withBusyState(deleteKey, function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, superadmin_api_1.deleteMasterDataItem)(accessToken, pendingDelete.entity, pendingDelete.id)];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, loadMasterData()];
                                    case 2:
                                        _a.sent();
                                        if (pendingDelete.entity === "administrator") {
                                            setNotice("Deleted administrator access.");
                                        }
                                        else if (pendingDelete.entity === "barangay") {
                                            setNotice("Deleted barangay.");
                                        }
                                        else if (pendingDelete.entity === "toda") {
                                            setNotice("Deleted TODA.");
                                        }
                                        else {
                                            setNotice("Deleted route.");
                                        }
                                        if ((activeModal === null || activeModal === void 0 ? void 0 : activeModal.entity) === pendingDelete.entity && activeModal.id === pendingDelete.id) {
                                            closeModal();
                                        }
                                        closeDeleteDialog();
                                        onDataChanged === null || onDataChanged === void 0 ? void 0 : onDataChanged();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var updateDriverDraft = function (driverId, patch) {
        resetNotice();
        setData(function (current) { return (__assign(__assign({}, current), { drivers: current.drivers.map(function (item) {
                return item.driverId === driverId ? __assign(__assign({}, item), patch) : item;
            }) })); });
    };
    var updateTricycleDraft = function (tricycleId, patch) {
        resetNotice();
        setData(function (current) { return (__assign(__assign({}, current), { tricycles: current.tricycles.map(function (item) {
                return item.tricycleId === tricycleId ? __assign(__assign({}, item), patch) : item;
            }) })); });
    };
    var saveDriver = function (row) { return __awaiter(_this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, withBusyState("driver-".concat(row.driverId), function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, (0, superadmin_api_1.updateMasterDataItem)(accessToken, "driver", row.driverId, {
                                        todaId: row.todaId,
                                        tricycleId: row.tricycleId,
                                        qrId: row.qrId,
                                        firstName: row.firstName,
                                        lastName: row.lastName,
                                        contactNo: row.contactNo || undefined,
                                        status: row.status
                                    })];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, loadMasterData()];
                                case 2:
                                    _a.sent();
                                    setNotice("Updated driver ".concat(row.firstName, " ").concat(row.lastName, "."));
                                    onDataChanged === null || onDataChanged === void 0 ? void 0 : onDataChanged();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var saveTricycle = function (row) { return __awaiter(_this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, withBusyState("tricycle-".concat(row.tricycleId), function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, (0, superadmin_api_1.updateMasterDataItem)(accessToken, "tricycle", row.tricycleId, {
                                        todaId: row.todaId,
                                        plateNo: row.plateNo,
                                        regNo: row.regNo || undefined,
                                        permitExpirationDate: row.permitExpirationDate || undefined,
                                        status: row.status
                                    })];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, loadMasterData()];
                                case 2:
                                    _a.sent();
                                    setNotice("Updated tricycle ".concat(row.plateNo, "."));
                                    onDataChanged === null || onDataChanged === void 0 ? void 0 : onDataChanged();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var modalBusyKey = activeModal
        ? activeModal.mode === "create"
            ? "create-".concat(activeModal.entity)
            : "save-".concat(activeModal.entity, "-").concat(activeModal.id)
        : null;
    var routeDefaultFareInvalid = routeForm.defaultFareAmount.trim().length > 0 &&
        (!Number.isFinite(Number(routeForm.defaultFareAmount)) ||
            Number(routeForm.defaultFareAmount) < 0);
    var modalSubmitDisabled = !activeModal
        ? true
        : activeModal.entity === "administrator"
            ? !administratorForm.email.trim() ||
                (administratorForm.password.trim().length > 0 &&
                    !isStrongTemporaryPassword(administratorForm.password.trim())) ||
                (administratorForm.role === "barangay_admin"
                    ? !administratorForm.barangayId
                    : administratorForm.role === "toda_admin"
                        ? !administratorForm.todaId
                        : false)
            : activeModal.entity === "barangay"
                ? !barangayForm.barangayName.trim() || !barangayForm.city.trim()
                : activeModal.entity === "toda"
                    ? !todaForm.barangayId || !todaForm.todaName.trim()
                    : !routeForm.todaId ||
                        !routeForm.origin.trim() ||
                        !routeForm.destination.trim() ||
                        routeDefaultFareInvalid;
    var modalTitle = !activeModal
        ? ""
        : activeModal.entity === "administrator"
            ? activeModal.mode === "create"
                ? "Add Administrator"
                : "Edit Administrator"
            : activeModal.entity === "barangay"
                ? activeModal.mode === "create"
                    ? "Add Barangay"
                    : "Edit Barangay"
                : activeModal.entity === "toda"
                    ? activeModal.mode === "create"
                        ? "Add TODA"
                        : "Edit TODA"
                    : activeModal.mode === "create"
                        ? "Add Route"
                        : "Edit Route";
    var modalDescription = !activeModal
        ? ""
        : activeModal.entity === "administrator"
            ? activeModal.mode === "create"
                ? "Create or link an authenticated admin account, then assign its role and access scope."
                : "Adjust role access, scope, and account status for this administrator."
            : activeModal.entity === "barangay"
                ? activeModal.mode === "create"
                    ? "Create a barangay record for the settings workspace."
                    : "Update barangay details and availability."
                : activeModal.entity === "toda"
                    ? activeModal.mode === "create"
                        ? "Create a TODA and assign it to a barangay."
                        : "Update the TODA assignment and status."
                    : activeModal.mode === "create"
                        ? "Create a route for a TODA."
                        : "Update route details, status, and geofence.";
    var modalSubmitLabel = activeModal
        ? busyKey === modalBusyKey
            ? "Saving..."
            : activeModal.mode === "create"
                ? "Create ".concat(formatEntityLabel(activeModal.entity))
                : "Save Changes"
        : "Save";
    if (isTodaAdminMode) {
        return (<section className="superadmin-page">
        <header className="superadmin-hero">
          <div>
            <div className="superadmin-hero__eyebrow">Operations</div>
            <h2>TODA Operations</h2>
            <p>Manage drivers and tricycles for {lockedTodaLabel !== null && lockedTodaLabel !== void 0 ? lockedTodaLabel : "your assigned TODA"}.</p>
          </div>
          <button type="button" className={"superadmin-refresh-button ".concat(loading ? "superadmin-refresh-button--loading" : "")} onClick={function () { return void loadMasterData(); }} disabled={loading} aria-label={loading ? "Refreshing TODA operations" : "Refresh TODA operations"} title={loading ? "Refreshing TODA operations" : "Refresh TODA operations"}>
            <RefreshIcon />
          </button>
        </header>

        {(error || notice) && (<div className={"superadmin-banner ".concat(error ? "superadmin-banner--error" : "")}>
            {error !== null && error !== void 0 ? error : notice}
          </div>)}

        <section className="superadmin-create-grid">
          <article className="superadmin-surface superadmin-form-card">
            <div className="superadmin-table-card__header">
              <div>
                <h3>Add Driver</h3>
                <p>Register a driver and connect the record to a tricycle when available.</p>
              </div>
            </div>
            <select value={driverForm.todaId} onChange={function (event) {
                return setDriverForm(function (current) { return (__assign(__assign({}, current), { todaId: event.target.value })); });
            }} disabled={isTodaAdminMode}>
              <option value="">Select TODA</option>
              {todaOptions.map(function (toda) { return (<option key={toda.todaId} value={toda.todaId}>
                  {toda.barangayName} - {toda.todaName}
                </option>); })}
            </select>
            <select value={driverForm.tricycleId} onChange={function (event) {
                return setDriverForm(function (current) { return (__assign(__assign({}, current), { tricycleId: event.target.value })); });
            }}>
              <option value="">Assign tricycle</option>
              {tricycleOptions.map(function (tricycle) { return (<option key={tricycle.tricycleId} value={tricycle.tricycleId}>
                  {tricycle.barangayName} - {tricycle.todaName} - {tricycle.plateNo}
                </option>); })}
            </select>
            <input value={driverForm.qrId} onChange={function (event) {
                return setDriverForm(function (current) { return (__assign(__assign({}, current), { qrId: event.target.value })); });
            }} placeholder="QR ID"/>
            <input value={driverForm.firstName} onChange={function (event) {
                return setDriverForm(function (current) { return (__assign(__assign({}, current), { firstName: event.target.value })); });
            }} placeholder="First name"/>
            <input value={driverForm.lastName} onChange={function (event) {
                return setDriverForm(function (current) { return (__assign(__assign({}, current), { lastName: event.target.value })); });
            }} placeholder="Last name"/>
            <input value={driverForm.contactNo} onChange={function (event) {
                return setDriverForm(function (current) { return (__assign(__assign({}, current), { contactNo: event.target.value })); });
            }} placeholder="Contact number"/>
            <button type="button" className="superadmin-primary-button" onClick={function () { return void handleCreateDriver(); }} disabled={busyKey === "create-driver" ||
                !driverForm.todaId ||
                !driverForm.firstName ||
                !driverForm.lastName}>
              {busyKey === "create-driver" ? "Saving..." : "Create Driver"}
            </button>
          </article>

          <article className="superadmin-surface superadmin-form-card">
            <div className="superadmin-table-card__header">
              <div>
                <h3>Add Tricycle</h3>
                <p>Register a unit for your TODA and track permit details in one place.</p>
              </div>
            </div>
            <select value={tricycleForm.todaId} onChange={function (event) {
                return setTricycleForm(function (current) { return (__assign(__assign({}, current), { todaId: event.target.value })); });
            }} disabled={isTodaAdminMode}>
              <option value="">Select TODA</option>
              {todaOptions.map(function (toda) { return (<option key={toda.todaId} value={toda.todaId}>
                  {toda.barangayName} - {toda.todaName}
                </option>); })}
            </select>
            <input value={tricycleForm.plateNo} onChange={function (event) {
                return setTricycleForm(function (current) { return (__assign(__assign({}, current), { plateNo: event.target.value })); });
            }} placeholder="Plate no"/>
            <input value={tricycleForm.regNo} onChange={function (event) {
                return setTricycleForm(function (current) { return (__assign(__assign({}, current), { regNo: event.target.value })); });
            }} placeholder="Registration no"/>
            <input type="date" value={tricycleForm.permitExpirationDate} onChange={function (event) {
                return setTricycleForm(function (current) { return (__assign(__assign({}, current), { permitExpirationDate: event.target.value })); });
            }}/>
            <button type="button" className="superadmin-primary-button" onClick={function () { return void handleCreateTricycle(); }} disabled={busyKey === "create-tricycle" || !tricycleForm.todaId || !tricycleForm.plateNo}>
              {busyKey === "create-tricycle" ? "Saving..." : "Create Tricycle"}
            </button>
          </article>
        </section>

        <section className="superadmin-surface superadmin-table-card">
          <div className="superadmin-table-card__header">
            <div>
              <h3>Drivers</h3>
              <p>Maintain the driver records available to your TODA mobile units.</p>
            </div>
          </div>
          <div className="superadmin-table-scroll">
            <table className="superadmin-data-table">
              <thead>
                <tr>
                  <th>Tricycle</th>
                  <th>QR ID</th>
                  <th>First name</th>
                  <th>Last name</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Password</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.length === 0 ? (<tr>
                    <td colSpan={8}>
                      <div className="superadmin-empty-state">
                        {hasSearchQuery
                    ? "No drivers match \"".concat(searchQuery.trim(), "\".")
                    : "No drivers have been added to this TODA yet."}
                      </div>
                    </td>
                  </tr>) : (filteredDrivers.map(function (row) {
                var _a, _b, _c;
                return (<tr key={row.driverId}>
                      <td>
                        <select value={(_a = row.tricycleId) !== null && _a !== void 0 ? _a : ""} onChange={function (event) {
                        var _a;
                        var tricycleId = event.target.value
                            ? Number(event.target.value)
                            : undefined;
                        var tricycle = data.tricycles.find(function (item) { return item.tricycleId === tricycleId; });
                        updateDriverDraft(row.driverId, {
                            tricycleId: tricycleId,
                            tricycleNo: (_a = tricycle === null || tricycle === void 0 ? void 0 : tricycle.plateNo) !== null && _a !== void 0 ? _a : row.tricycleNo
                        });
                    }}>
                          <option value="">Assign tricycle</option>
                          {tricycleOptions.map(function (tricycle) { return (<option key={tricycle.tricycleId} value={tricycle.tricycleId}>
                              {tricycle.barangayName} - {tricycle.todaName} - {tricycle.plateNo}
                            </option>); })}
                        </select>
                      </td>
                      <td>
                        <input value={(_b = row.qrId) !== null && _b !== void 0 ? _b : ""} onChange={function (event) {
                        return updateDriverDraft(row.driverId, {
                            qrId: event.target.value ? Number(event.target.value) : undefined
                        });
                    }}/>
                      </td>
                      <td>
                        <input value={row.firstName} onChange={function (event) {
                        return updateDriverDraft(row.driverId, { firstName: event.target.value });
                    }}/>
                      </td>
                      <td>
                        <input value={row.lastName} onChange={function (event) {
                        return updateDriverDraft(row.driverId, { lastName: event.target.value });
                    }}/>
                      </td>
                      <td>
                        <input value={(_c = row.contactNo) !== null && _c !== void 0 ? _c : ""} onChange={function (event) {
                        return updateDriverDraft(row.driverId, { contactNo: event.target.value });
                    }}/>
                      </td>
                      <td>
                        <select value={row.status} onChange={function (event) {
                        return updateDriverDraft(row.driverId, {
                            status: event.target.value
                        });
                    }}>
                          {STATUS_OPTIONS.map(function (status) { return (<option key={status} value={status}>
                              {formatStatusLabel(status)}
                            </option>); })}
                        </select>
                      </td>
                      <td>
                        <span className="superadmin-badge">
                          {row.passwordSet ? "Set" : "Pending"}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="superadmin-primary-button superadmin-primary-button--compact" onClick={function () { return void saveDriver(row); }} disabled={busyKey === "driver-".concat(row.driverId)}>
                          {busyKey === "driver-".concat(row.driverId) ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>);
            }))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="superadmin-surface superadmin-table-card">
          <div className="superadmin-table-card__header">
            <div>
              <h3>Tricycles</h3>
              <p>Manage the units assigned to your TODA.</p>
            </div>
          </div>
          <div className="superadmin-table-scroll">
            <table className="superadmin-data-table">
              <thead>
                <tr>
                  <th>Plate no</th>
                  <th>Reg no</th>
                  <th>Permit exp.</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredTricycles.length === 0 ? (<tr>
                    <td colSpan={5}>
                      <div className="superadmin-empty-state">
                        {hasSearchQuery
                    ? "No tricycles match \"".concat(searchQuery.trim(), "\".")
                    : "No tricycles have been added to this TODA yet."}
                      </div>
                    </td>
                  </tr>) : (filteredTricycles.map(function (row) {
                var _a;
                return (<tr key={row.tricycleId}>
                      <td>
                        <input value={row.plateNo} onChange={function (event) {
                        return updateTricycleDraft(row.tricycleId, { plateNo: event.target.value });
                    }}/>
                      </td>
                      <td>
                        <input value={(_a = row.regNo) !== null && _a !== void 0 ? _a : ""} onChange={function (event) {
                        return updateTricycleDraft(row.tricycleId, { regNo: event.target.value });
                    }}/>
                      </td>
                      <td>
                        <input type="date" value={toDateInputValue(row.permitExpirationDate)} onChange={function (event) {
                        return updateTricycleDraft(row.tricycleId, {
                            permitExpirationDate: event.target.value
                        });
                    }}/>
                      </td>
                      <td>
                        <select value={row.status} onChange={function (event) {
                        return updateTricycleDraft(row.tricycleId, {
                            status: event.target.value
                        });
                    }}>
                          {STATUS_OPTIONS.map(function (status) { return (<option key={status} value={status}>
                              {formatStatusLabel(status)}
                            </option>); })}
                        </select>
                      </td>
                      <td>
                        <button type="button" className="superadmin-primary-button superadmin-primary-button--compact" onClick={function () { return void saveTricycle(row); }} disabled={busyKey === "tricycle-".concat(row.tricycleId)}>
                          {busyKey === "tricycle-".concat(row.tricycleId) ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>);
            }))}
              </tbody>
            </table>
          </div>
        </section>
      </section>);
    }
    return (<section className="superadmin-page">
      <div className="superadmin-page__static">
        <header className="superadmin-hero superadmin-hero--actions-only">
          <button type="button" className={"superadmin-refresh-button ".concat(loading ? "superadmin-refresh-button--loading" : "")} onClick={function () { return void loadMasterData(); }} disabled={loading} aria-label={loading ? "Refreshing settings" : "Refresh settings"} title={loading ? "Refreshing settings" : "Refresh settings"}>
            <RefreshIcon />
          </button>
        </header>

        <section className="superadmin-summary">
          <article className="superadmin-surface superadmin-stat">
            <span>Administrators</span>
            <strong>{data.administrators.length}</strong>
            <small>Existing linked admin accounts</small>
          </article>
          <article className="superadmin-surface superadmin-stat">
            <span>Barangays</span>
            <strong>{data.barangays.length}</strong>
            <small>Location groups ready for assignment</small>
          </article>
          <article className="superadmin-surface superadmin-stat">
            <span>TODAs</span>
            <strong>{data.todas.length}</strong>
            <small>Registered transport groups</small>
          </article>
          <article className="superadmin-surface superadmin-stat">
            <span>Routes</span>
            <strong>{data.routes.length}</strong>
            <small>Published travel definitions</small>
          </article>
          <article className="superadmin-surface superadmin-stat">
            <span>Total records</span>
            <strong>{totalRecordsManaged}</strong>
            <small>Across admins, fleets, and coverage</small>
          </article>
        </section>

        {(error || notice) && (<div className={"superadmin-banner ".concat(error ? "superadmin-banner--error" : "")}>
            {error !== null && error !== void 0 ? error : notice}
          </div>)}

        <section className="superadmin-surface superadmin-tabs">
          {SETTINGS_TABS.map(function (tab) { return (<button key={tab.key} type="button" className={"superadmin-tab ".concat(tab.key === activeTab ? "superadmin-tab--active" : "")} onClick={function () { return setActiveTab(tab.key); }}>
              {tab.label}
            </button>); })}
        </section>
      </div>

      <div className="superadmin-page__content">
        {activeTab === "admin-panel" && (<section className="superadmin-surface superadmin-table-card">
            <div className="superadmin-table-card__header">
              <div>
                <h3>Admin Panel</h3>
              </div>
            </div>
            <div className="superadmin-table-scroll">
              <table className="superadmin-data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Name</th>
                    <th>Scope</th>
                    <th>Added</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecentActivity.length === 0 ? (<tr>
                      <td colSpan={5}>
                        <div className="superadmin-empty-state">
                          {hasSearchQuery
                    ? "No settings records match \"".concat(searchQuery.trim(), "\".")
                    : "No settings records are available yet."}
                        </div>
                      </td>
                    </tr>) : (filteredRecentActivity.map(function (item) { return (<tr key={item.key}>
                        <td>
                          <span className="superadmin-category-chip">{item.category}</span>
                        </td>
                        <td>{item.title}</td>
                        <td>{item.scope}</td>
                        <td>{formatDateLabel(item.createdAt)}</td>
                        <td>
                          <span className={"superadmin-status superadmin-status--".concat(item.status)}>
                            {formatStatusLabel(item.status)}
                          </span>
                        </td>
                      </tr>); }))}
                </tbody>
              </table>
            </div>
          </section>)}

        {activeTab === "barangays" && (<section className="superadmin-surface superadmin-table-card">
            <div className="superadmin-table-card__header">
              <div>
                <h3>Barangays</h3>
                <p>Modify the location scope available to administrators and TODAs.</p>
              </div>
              <button type="button" className="superadmin-primary-button" onClick={openBarangayCreateModal}>
                Add Barangay
              </button>
            </div>
            <div className="superadmin-table-scroll">
              <table className="superadmin-data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>District</th>
                    <th>City</th>
                    <th>TODAs</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredBarangays.length === 0 ? (<tr>
                      <td colSpan={6}>
                        <div className="superadmin-empty-state">
                          {hasSearchQuery
                    ? "No barangays match \"".concat(searchQuery.trim(), "\".")
                    : "No barangays added yet."}
                        </div>
                      </td>
                    </tr>) : (filteredBarangays.map(function (row) {
                var rowBusy = busyKey === "save-barangay-".concat(row.barangayId) ||
                    busyKey === "delete-barangay-".concat(row.barangayId);
                return (<tr key={row.barangayId}>
                          <td>{row.barangayName}</td>
                          <td>{row.district || "Not set"}</td>
                          <td>{row.city}</td>
                          <td>
                            <span className="superadmin-badge">{row.todaCount}</span>
                          </td>
                          <td>
                            <span className={"superadmin-status superadmin-status--".concat(row.status)}>
                              {formatStatusLabel(row.status)}
                            </span>
                          </td>
                          <td>
                            <div className="superadmin-row-actions">
                              <button type="button" className="superadmin-secondary-button" onClick={function () { return openBarangayEditModal(row); }} disabled={rowBusy}>
                                Edit
                              </button>
                              <button type="button" className="superadmin-danger-button" onClick={function () { return openDeleteBarangayDialog(row); }} disabled={rowBusy}>
                                {busyKey === "delete-barangay-".concat(row.barangayId)
                        ? "Deleting..."
                        : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>);
            }))}
                </tbody>
              </table>
            </div>
          </section>)}

      {activeTab === "todas" && (<section className="superadmin-surface superadmin-table-card">
          <div className="superadmin-table-card__header">
            <div>
              <h3>TODAs</h3>
              <p>Assign TODAs to barangays and monitor their fleet readiness.</p>
            </div>
            <button type="button" className="superadmin-primary-button" onClick={openTodaCreateModal} disabled={barangayOptions.length === 0}>
              Add TODA
            </button>
          </div>
          <div className="superadmin-table-scroll">
            <table className="superadmin-data-table">
              <thead>
                <tr>
                  <th>Barangay</th>
                  <th>TODA</th>
                  <th>Drivers</th>
                  <th>Tricycles</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredTodas.length === 0 ? (<tr>
                    <td colSpan={6}>
                      <div className="superadmin-empty-state">
                        {hasSearchQuery
                    ? "No TODAs match \"".concat(searchQuery.trim(), "\".")
                    : "No TODAs added yet."}
                      </div>
                    </td>
                  </tr>) : (filteredTodas.map(function (row) {
                var rowBusy = busyKey === "save-toda-".concat(row.todaId) || busyKey === "delete-toda-".concat(row.todaId);
                return (<tr key={row.todaId}>
                        <td>{row.barangayName}</td>
                        <td>{row.todaName}</td>
                        <td>
                          <span className="superadmin-badge">{row.driverCount}</span>
                        </td>
                        <td>
                          <span className="superadmin-badge">{row.tricycleCount}</span>
                        </td>
                        <td>
                          <span className={"superadmin-status superadmin-status--".concat(row.status)}>
                            {formatStatusLabel(row.status)}
                          </span>
                        </td>
                        <td>
                          <div className="superadmin-row-actions">
                            <button type="button" className="superadmin-secondary-button" onClick={function () { return openTodaEditModal(row); }} disabled={rowBusy}>
                              Edit
                            </button>
                            <button type="button" className="superadmin-danger-button" onClick={function () { return openDeleteTodaDialog(row); }} disabled={rowBusy}>
                              {busyKey === "delete-toda-".concat(row.todaId) ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>);
            }))}
              </tbody>
            </table>
          </div>
        </section>)}

      {activeTab === "routes" && (<section className="superadmin-surface superadmin-table-card">
          <div className="superadmin-table-card__header">
            <div>
              <h3>Routes</h3>
              <p>Keep route definitions current before connecting the mobile app.</p>
            </div>
            <button type="button" className="superadmin-primary-button" onClick={openRouteCreateModal} disabled={todaOptions.length === 0}>
              Add Route
            </button>
          </div>
          <div className="superadmin-table-scroll">
            <table className="superadmin-data-table">
              <thead>
                <tr>
                  <th>TODA</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Default Fare</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredRoutes.length === 0 ? (<tr>
                    <td colSpan={6}>
                      <div className="superadmin-empty-state">
                        {hasSearchQuery
                    ? "No routes match \"".concat(searchQuery.trim(), "\".")
                    : "No routes added yet."}
                      </div>
                    </td>
                  </tr>) : (filteredRoutes.map(function (row) {
                var rowBusy = busyKey === "save-route-".concat(row.routeId) ||
                    busyKey === "delete-route-".concat(row.routeId);
                return (<tr key={row.routeId}>
                        <td>{"".concat(row.barangayName, " / ").concat(row.todaName)}</td>
                        <td>{row.origin}</td>
                        <td>{row.destination}</td>
                        <td>{formatFareLabel(row.defaultFareAmount)}</td>
                        <td>
                          <span className={"superadmin-status superadmin-status--".concat(row.status)}>
                            {formatStatusLabel(row.status)}
                          </span>
                        </td>
                        <td>
                          <div className="superadmin-row-actions">
                            <button type="button" className="superadmin-secondary-button" onClick={function () { return openRouteEditModal(row); }} disabled={rowBusy}>
                              Edit
                            </button>
                            <button type="button" className="superadmin-danger-button" onClick={function () { return openDeleteRouteDialog(row); }} disabled={rowBusy}>
                              {busyKey === "delete-route-".concat(row.routeId) ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>);
            }))}
              </tbody>
            </table>
          </div>
        </section>)}

      {activeTab === "administrators" && (<section className="superadmin-surface superadmin-table-card">
          <div className="superadmin-table-card__header">
            <div>
              <h3>Administrators</h3>
              <p>Review linked admin accounts and organize access by role and scope.</p>
            </div>
            <button type="button" className="superadmin-primary-button" onClick={openAdministratorCreateModal}>
              Add Admin
            </button>
          </div>
          <div className="superadmin-table-scroll">
            <table className="superadmin-data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredAdministrators.length === 0 ? (<tr>
                    <td colSpan={6}>
                      <div className="superadmin-empty-state">
                        {hasSearchQuery
                    ? "No administrators match \"".concat(searchQuery.trim(), "\".")
                    : "No administrator accounts are linked yet."}
                      </div>
                    </td>
                  </tr>) : (filteredAdministrators.map(function (row) {
                var rowBusy = busyKey === "delete-administrator-".concat(row.adminId);
                return (<tr key={row.adminId}>
                        <td>{row.email}</td>
                        <td>{formatRoleLabel(row.role)}</td>
                        <td>{formatAdministratorScope(row)}</td>
                        <td>
                          <span className={"superadmin-status superadmin-status--".concat(row.status)}>
                            {formatStatusLabel(row.status)}
                          </span>
                        </td>
                        <td>{formatDateLabel(row.createdAt)}</td>
                        <td>
                          <div className="superadmin-row-actions">
                            <button type="button" className="superadmin-secondary-button" onClick={function () { return openAdministratorEditModal(row); }} disabled={rowBusy}>
                              Edit
                            </button>
                            <button type="button" className="superadmin-danger-button" onClick={function () { return openDeleteAdministratorDialog(row); }} disabled={rowBusy}>
                              {rowBusy ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>);
            }))}
              </tbody>
            </table>
          </div>
        </section>)}
      </div>

      {activeModal && (<div className="superadmin-modal-backdrop" role="presentation" onClick={closeModal}>
          <div className="superadmin-modal" role="dialog" aria-modal="true" aria-labelledby="superadmin-modal-title" onClick={function (event) { return event.stopPropagation(); }}>
            <div className="superadmin-modal__header">
              <div>
                <h3 id="superadmin-modal-title">{modalTitle}</h3>
                <p>{modalDescription}</p>
              </div>
              <button type="button" className="superadmin-modal__close" onClick={closeModal} aria-label="Close dialog">
                ×
              </button>
            </div>

            <div className="superadmin-modal__body">
              {activeModal.entity === "administrator" && (<>
                  <label className="superadmin-field">
                    <span>Email</span>
                    <input type="email" value={administratorForm.email} onChange={function (event) {
                    return setAdministratorForm(function (current) { return (__assign(__assign({}, current), { email: event.target.value })); });
                }} placeholder="Use a valid email, e.g. admin@example.com" readOnly={activeModal.mode === "edit"}/>
                    {activeModal.mode === "create" && (<small>
                        Enter a real email address for the admin account, such as name@example.com.
                      </small>)}
                  </label>
                  {activeModal.mode === "create" && (<label className="superadmin-field">
                      <span>Temporary Password</span>
                      <input type="password" minLength={8} value={administratorForm.password} onChange={function (event) {
                        return setAdministratorForm(function (current) { return (__assign(__assign({}, current), { password: event.target.value })); });
                    }} placeholder="Strong password"/>
                      <small>
                        Use a strong password with at least 8 characters, uppercase, lowercase,
                        and a number. Leave blank only to link an existing authenticated user.
                      </small>
                    </label>)}
                  <label className="superadmin-field">
                    <span>Role</span>
                    <select value={administratorForm.role} onChange={function (event) {
                    var nextRole = event.target.value;
                    setAdministratorForm(function (current) { return (__assign(__assign({}, current), { role: nextRole, barangayId: nextRole === "barangay_admin" ? current.barangayId : "", todaId: nextRole === "toda_admin" ? current.todaId : "" })); });
                }}>
                      {ROLE_OPTIONS.map(function (role) { return (<option key={role} value={role}>
                          {formatRoleLabel(role)}
                        </option>); })}
                    </select>
                  </label>
                  {administratorForm.role === "barangay_admin" && (<label className="superadmin-field">
                      <span>Barangay</span>
                      <select value={administratorForm.barangayId} onChange={function (event) {
                        return setAdministratorForm(function (current) { return (__assign(__assign({}, current), { barangayId: event.target.value })); });
                    }}>
                        <option value="">Select barangay</option>
                        {barangayOptions.map(function (barangay) { return (<option key={barangay.barangayId} value={barangay.barangayId}>
                            {barangay.barangayName}
                          </option>); })}
                      </select>
                    </label>)}
                  {administratorForm.role === "toda_admin" && (<label className="superadmin-field">
                      <span>TODA</span>
                      <select value={administratorForm.todaId} onChange={function (event) {
                        return setAdministratorForm(function (current) { return (__assign(__assign({}, current), { todaId: event.target.value })); });
                    }}>
                        <option value="">Select TODA</option>
                        {todaOptions.map(function (toda) { return (<option key={toda.todaId} value={toda.todaId}>
                            {toda.barangayName} - {toda.todaName}
                          </option>); })}
                      </select>
                    </label>)}
                  <label className="superadmin-field">
                    <span>Status</span>
                    <select value={administratorForm.status} onChange={function (event) {
                    return setAdministratorForm(function (current) { return (__assign(__assign({}, current), { status: event.target.value })); });
                }}>
                      {STATUS_OPTIONS.map(function (status) { return (<option key={status} value={status}>
                          {formatStatusLabel(status)}
                        </option>); })}
                    </select>
                  </label>
                </>)}

              {activeModal.entity === "barangay" && (<>
                  <label className="superadmin-field">
                    <span>Barangay Name</span>
                    <input value={barangayForm.barangayName} onChange={function (event) {
                    return setBarangayForm(function (current) { return (__assign(__assign({}, current), { barangayName: event.target.value })); });
                }} placeholder="Barangay name"/>
                  </label>
                  <label className="superadmin-field">
                    <span>District</span>
                    <input value={barangayForm.district} onChange={function (event) {
                    return setBarangayForm(function (current) { return (__assign(__assign({}, current), { district: event.target.value })); });
                }} placeholder="District"/>
                  </label>
                  <label className="superadmin-field">
                    <span>City</span>
                    <input value={barangayForm.city} onChange={function (event) {
                    return setBarangayForm(function (current) { return (__assign(__assign({}, current), { city: event.target.value })); });
                }} placeholder="City"/>
                  </label>
                  {activeModal.mode === "edit" && (<label className="superadmin-field">
                      <span>Status</span>
                      <select value={barangayForm.status} onChange={function (event) {
                        return setBarangayForm(function (current) { return (__assign(__assign({}, current), { status: event.target.value })); });
                    }}>
                        {STATUS_OPTIONS.map(function (status) { return (<option key={status} value={status}>
                            {formatStatusLabel(status)}
                          </option>); })}
                      </select>
                    </label>)}
                </>)}

              {activeModal.entity === "toda" && (<>
                  <label className="superadmin-field">
                    <span>Barangay</span>
                    <select value={todaForm.barangayId} onChange={function (event) {
                    return setTodaForm(function (current) { return (__assign(__assign({}, current), { barangayId: event.target.value })); });
                }}>
                      <option value="">Select barangay</option>
                      {barangayOptions.map(function (barangay) { return (<option key={barangay.barangayId} value={barangay.barangayId}>
                          {barangay.barangayName}
                        </option>); })}
                    </select>
                  </label>
                  <label className="superadmin-field">
                    <span>TODA Name</span>
                    <input value={todaForm.todaName} onChange={function (event) {
                    return setTodaForm(function (current) { return (__assign(__assign({}, current), { todaName: event.target.value })); });
                }} placeholder="TODA name"/>
                  </label>
                  {activeModal.mode === "edit" && (<label className="superadmin-field">
                      <span>Status</span>
                      <select value={todaForm.status} onChange={function (event) {
                        return setTodaForm(function (current) { return (__assign(__assign({}, current), { status: event.target.value })); });
                    }}>
                        {STATUS_OPTIONS.map(function (status) { return (<option key={status} value={status}>
                            {formatStatusLabel(status)}
                          </option>); })}
                      </select>
                    </label>)}
                </>)}

              {activeModal.entity === "route" && (<>
                  <label className="superadmin-field">
                    <span>TODA</span>
                    <select value={routeForm.todaId} onChange={function (event) {
                    return setRouteForm(function (current) { return (__assign(__assign({}, current), { todaId: event.target.value })); });
                }}>
                      <option value="">Select TODA</option>
                      {todaOptions.map(function (toda) { return (<option key={toda.todaId} value={toda.todaId}>
                          {toda.barangayName} - {toda.todaName}
                        </option>); })}
                    </select>
                  </label>
                  <label className="superadmin-field">
                    <span>Origin</span>
                    <input value={routeForm.origin} onChange={function (event) {
                    return setRouteForm(function (current) { return (__assign(__assign({}, current), { origin: event.target.value })); });
                }} placeholder="Origin"/>
                  </label>
                  <label className="superadmin-field">
                    <span>Destination</span>
                    <input value={routeForm.destination} onChange={function (event) {
                    return setRouteForm(function (current) { return (__assign(__assign({}, current), { destination: event.target.value })); });
                }} placeholder="Destination"/>
                  </label>
                  <label className="superadmin-field">
                    <span>Default fare</span>
                    <input type="number" min="0" step="0.01" value={routeForm.defaultFareAmount} onChange={function (event) {
                    return setRouteForm(function (current) { return (__assign(__assign({}, current), { defaultFareAmount: event.target.value })); });
                }} placeholder="Optional PHP amount"/>
                    <small>Used by the passenger QR fare checker before a trip is completed.</small>
                  </label>
                  <label className="superadmin-field">
                    <span>Geofence GeoJSON</span>
                    <textarea rows={6} value={routeForm.geofenceGeojsonText} onChange={function (event) {
                    return setRouteForm(function (current) { return (__assign(__assign({}, current), { geofenceGeojsonText: event.target.value })); });
                }} placeholder="Optional geofence GeoJSON"/>
                  </label>
                  {activeModal.mode === "edit" && (<label className="superadmin-field">
                      <span>Status</span>
                      <select value={routeForm.status} onChange={function (event) {
                        return setRouteForm(function (current) { return (__assign(__assign({}, current), { status: event.target.value })); });
                    }}>
                        {STATUS_OPTIONS.map(function (status) { return (<option key={status} value={status}>
                            {formatStatusLabel(status)}
                          </option>); })}
                      </select>
                    </label>)}
                </>)}
            </div>

            <div className="superadmin-modal__footer">
              <button type="button" className="superadmin-secondary-button" onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className="superadmin-primary-button" onClick={function () { return void submitSuperadminModal(); }} disabled={modalSubmitDisabled || busyKey === modalBusyKey}>
                {modalSubmitLabel}
              </button>
            </div>
          </div>
        </div>)}

      <DeleteConfirmDialog_1.default open={pendingDelete !== null} title={(_b = pendingDelete === null || pendingDelete === void 0 ? void 0 : pendingDelete.title) !== null && _b !== void 0 ? _b : ""} description={(_c = pendingDelete === null || pendingDelete === void 0 ? void 0 : pendingDelete.description) !== null && _c !== void 0 ? _c : ""} confirmLabel={(_d = pendingDelete === null || pendingDelete === void 0 ? void 0 : pendingDelete.confirmLabel) !== null && _d !== void 0 ? _d : "Delete"} busy={pendingDelete ? busyKey === "delete-".concat(pendingDelete.entity, "-").concat(pendingDelete.id) : false} onConfirm={function () { return void confirmDelete(); }} onClose={closeDeleteDialog}/>
    </section>);
}
