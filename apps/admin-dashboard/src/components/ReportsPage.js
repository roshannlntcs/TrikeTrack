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
exports.default = ReportsPage;
var react_1 = require("react");
var reports_1 = require("../lib/reports");
var supabase_1 = require("../lib/supabase");
require("./ReportsPage.css");
var REPORT_STATUS_OPTIONS = [
    "submitted",
    "under_review",
    "verified",
    "resolved",
    "dismissed"
];
var APPEAL_STATUS_OPTIONS = [
    "all",
    "submitted",
    "under_review",
    "approved",
    "denied",
    "withdrawn"
];
var APPEAL_SUMMARY_STATUS_OPTIONS = APPEAL_STATUS_OPTIONS.filter(function (status) { return status !== "all"; });
var formatStatusLabel = function (value, fallback) {
    if (fallback === void 0) { fallback = "Unknown"; }
    if (!value)
        return fallback;
    return value
        .split("_")
        .map(function (part) { return part.charAt(0).toUpperCase() + part.slice(1); })
        .join(" ");
};
var formatReportStatus = function (value) {
    return formatStatusLabel(value);
};
var formatAppealStatus = function (value) {
    return formatStatusLabel(value);
};
var formatTripStatus = function (value) {
    return value ? formatStatusLabel(value) : "No active trip";
};
var formatViolationStatus = function (value) { return formatStatusLabel(value); };
var formatDateTime = function (value, fallback) {
    if (fallback === void 0) { fallback = "Unknown"; }
    if (!value)
        return fallback;
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
};
var truncateText = function (value, maxLength) {
    if (maxLength === void 0) { maxLength = 140; }
    var trimmed = value === null || value === void 0 ? void 0 : value.trim();
    if (!trimmed)
        return "No appeal message provided.";
    if (trimmed.length <= maxLength)
        return trimmed;
    return "".concat(trimmed.slice(0, maxLength).trimEnd(), "...");
};
var textMatches = function (value, normalizedSearchQuery) { return value !== undefined &&
    value !== null &&
    String(value).toLowerCase().includes(normalizedSearchQuery); };
var isPendingAppeal = function (appeal) {
    return appeal.status === "submitted" || appeal.status === "under_review";
};
var isUnviewedPendingAppeal = function (appeal) {
    return isPendingAppeal(appeal) && !appeal.viewedAt;
};
function ReportsPage(_a) {
    var _this = this;
    var _b, _c, _d, _e, _f, _g, _h, _j, _k;
    var accessToken = _a.accessToken, _l = _a.initialSection, initialSection = _l === void 0 ? "reports" : _l, controlledSearchQuery = _a.searchQuery, onSearchQueryChange = _a.onSearchQueryChange, onSearchPlaceholderChange = _a.onSearchPlaceholderChange, onDataChanged = _a.onDataChanged;
    var _m = (0, react_1.useState)([]), reports = _m[0], setReports = _m[1];
    var _o = (0, react_1.useState)([]), appeals = _o[0], setAppeals = _o[1];
    var _p = (0, react_1.useState)([]), reportTypes = _p[0], setReportTypes = _p[1];
    var _q = (0, react_1.useState)(true), loading = _q[0], setLoading = _q[1];
    var _r = (0, react_1.useState)(null), error = _r[0], setError = _r[1];
    var _s = (0, react_1.useState)(null), busyReportId = _s[0], setBusyReportId = _s[1];
    var _t = (0, react_1.useState)(initialSection), activeSection = _t[0], setActiveSection = _t[1];
    var _u = (0, react_1.useState)(""), localSearchQuery = _u[0], setLocalSearchQuery = _u[1];
    var _v = (0, react_1.useState)("all"), statusFilter = _v[0], setStatusFilter = _v[1];
    var _w = (0, react_1.useState)("all"), typeFilter = _w[0], setTypeFilter = _w[1];
    var _x = (0, react_1.useState)("all"), appealStatusFilter = _x[0], setAppealStatusFilter = _x[1];
    var _y = (0, react_1.useState)({}), draftStatuses = _y[0], setDraftStatuses = _y[1];
    var _z = (0, react_1.useState)(0), reloadTick = _z[0], setReloadTick = _z[1];
    var _0 = (0, react_1.useState)(null), selectedReport = _0[0], setSelectedReport = _0[1];
    var _1 = (0, react_1.useState)(null), selectedAppeal = _1[0], setSelectedAppeal = _1[1];
    var _2 = (0, react_1.useState)(null), cacheNotice = _2[0], setCacheNotice = _2[1];
    (0, react_1.useEffect)(function () {
        setActiveSection(initialSection);
    }, [initialSection]);
    (0, react_1.useEffect)(function () {
        onSearchPlaceholderChange === null || onSearchPlaceholderChange === void 0 ? void 0 : onSearchPlaceholderChange(activeSection === "reports"
            ? "Search report ID, driver, route, plate..."
            : "Search appeal ID, driver, violation, route...");
    }, [activeSection, onSearchPlaceholderChange]);
    (0, react_1.useEffect)(function () {
        var active = true;
        var cachedLoaded = false;
        void (function () { return __awaiter(_this, void 0, void 0, function () {
            var cached;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, reports_1.getCachedAdminReports)()];
                    case 1:
                        cached = _a.sent();
                        if (!active || !cached)
                            return [2 /*return*/];
                        cachedLoaded = true;
                        setReports(cached.reports);
                        setAppeals(cached.appeals);
                        setReportTypes(cached.reportTypes);
                        setDraftStatuses(Object.fromEntries(cached.reports.map(function (report) { return [report.reportId, report.status]; })));
                        setLoading(false);
                        setCacheNotice(cached.cacheMeta
                            ? "Offline-ready snapshot loaded from ".concat(formatDateTime(cached.cacheMeta.savedAt), ".")
                            : null);
                        return [2 /*return*/];
                }
            });
        }); })();
        var load = function () { return __awaiter(_this, void 0, void 0, function () {
            var data, loadError_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setLoading(true);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, (0, reports_1.fetchAdminReports)(accessToken)];
                    case 2:
                        data = _a.sent();
                        if (!active)
                            return [2 /*return*/];
                        setReports(data.reports);
                        setAppeals(data.appeals);
                        setReportTypes(data.reportTypes);
                        setDraftStatuses(Object.fromEntries(data.reports.map(function (report) { return [report.reportId, report.status]; })));
                        setCacheNotice(data.cacheMeta
                            ? "Showing cached reports from ".concat(formatDateTime(data.cacheMeta.savedAt), ".")
                            : null);
                        setError(null);
                        return [3 /*break*/, 5];
                    case 3:
                        loadError_1 = _a.sent();
                        if (!active)
                            return [2 /*return*/];
                        setError(cachedLoaded
                            ? "Unable to refresh reports right now. Showing the last synced records."
                            : String(loadError_1));
                        return [3 /*break*/, 5];
                    case 4:
                        if (active) {
                            setLoading(false);
                        }
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        void load();
        return function () {
            active = false;
        };
    }, [accessToken, reloadTick]);
    (0, react_1.useEffect)(function () {
        var refreshOnResume = function () {
            if (document.visibilityState === "hidden" || !navigator.onLine)
                return;
            setReloadTick(function (current) { return current + 1; });
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
    }, []);
    (0, react_1.useEffect)(function () {
        var reloadReports = function (refreshShell) {
            if (refreshShell === void 0) { refreshShell = true; }
            setReloadTick(function (current) { return current + 1; });
            if (refreshShell) {
                onDataChanged === null || onDataChanged === void 0 ? void 0 : onDataChanged();
            }
        };
        var reportsChannel = supabase_1.supabase
            .channel("admin-reports-page")
            .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "reports"
        }, function () { return reloadReports(); })
            .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "report_media"
        }, function () { return reloadReports(false); })
            .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "violations"
        }, function () { return reloadReports(); })
            .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "violation_appeals"
        }, function () { return reloadReports(); })
            .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "violation_proofs"
        }, function () { return reloadReports(false); })
            .subscribe();
        return function () {
            void supabase_1.supabase.removeChannel(reportsChannel);
        };
    }, [onDataChanged]);
    var searchQuery = controlledSearchQuery !== null && controlledSearchQuery !== void 0 ? controlledSearchQuery : localSearchQuery;
    var setSearchQuery = onSearchQueryChange !== null && onSearchQueryChange !== void 0 ? onSearchQueryChange : setLocalSearchQuery;
    var normalizedSearchQuery = searchQuery.trim().toLowerCase();
    var filteredReports = (0, react_1.useMemo)(function () {
        return reports.filter(function (report) {
            if (statusFilter !== "all" && report.status !== statusFilter) {
                return false;
            }
            if (typeFilter !== "all" && report.reportTypeCode !== typeFilter) {
                return false;
            }
            if (!normalizedSearchQuery)
                return true;
            return [
                report.driverName,
                report.driverCode,
                report.description,
                report.plateNo,
                report.routeName,
                report.todaName,
                report.barangayName,
                report.reportTypeLabel,
                report.passengerName,
                report.passengerContact,
                report.reportId,
                report.qrId,
                report.tripId,
                report.violationId
            ].some(function (value) { return textMatches(value, normalizedSearchQuery); });
        });
    }, [reports, statusFilter, typeFilter, normalizedSearchQuery]);
    var filteredAppeals = (0, react_1.useMemo)(function () {
        return appeals.filter(function (appeal) {
            if (appealStatusFilter !== "all" && appeal.status !== appealStatusFilter) {
                return false;
            }
            if (!normalizedSearchQuery)
                return true;
            return [
                appeal.driverName,
                appeal.driverCode,
                appeal.violationTypeLabel,
                appeal.appealReason,
                appeal.appealMessage,
                appeal.plateNo,
                appeal.routeName,
                appeal.todaName,
                appeal.barangayName,
                appeal.appealId,
                appeal.violationId,
                appeal.tripId
            ].some(function (value) { return textMatches(value, normalizedSearchQuery); });
        });
    }, [appeals, appealStatusFilter, normalizedSearchQuery]);
    var counts = (0, react_1.useMemo)(function () {
        return REPORT_STATUS_OPTIONS.reduce(function (totals, status) {
            totals[status] = reports.filter(function (report) { return report.status === status; }).length;
            return totals;
        }, {
            submitted: 0,
            under_review: 0,
            verified: 0,
            resolved: 0,
            dismissed: 0
        });
    }, [reports]);
    var appealCounts = (0, react_1.useMemo)(function () {
        return appeals.reduce(function (totals, appeal) {
            totals[appeal.status] += 1;
            return totals;
        }, {
            submitted: 0,
            under_review: 0,
            approved: 0,
            denied: 0,
            withdrawn: 0
        });
    }, [appeals]);
    var activeAppealTabCount = (0, react_1.useMemo)(function () { return appeals.filter(isUnviewedPendingAppeal).length; }, [appeals]);
    var closeModals = function () {
        setSelectedReport(null);
        setSelectedAppeal(null);
    };
    var handleOpenReport = function (report) {
        setSelectedAppeal(null);
        setSelectedReport(report);
    };
    var handleOpenAppeal = function (appeal) { return __awaiter(_this, void 0, void 0, function () {
        var optimisticViewedAt, nextAppeal_1, viewState_1, viewError_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setSelectedReport(null);
                    if (!!appeal.viewedAt) return [3 /*break*/, 5];
                    optimisticViewedAt = new Date().toISOString();
                    nextAppeal_1 = __assign(__assign({}, appeal), { viewedAt: optimisticViewedAt });
                    setAppeals(function (current) {
                        return current.map(function (item) {
                            return item.appealId === appeal.appealId ? nextAppeal_1 : item;
                        });
                    });
                    setSelectedAppeal(nextAppeal_1);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, reports_1.markAdminAppealViewed)(accessToken, appeal.appealId)];
                case 2:
                    viewState_1 = _a.sent();
                    setAppeals(function (current) {
                        return current.map(function (item) {
                            return item.appealId === viewState_1.appealId
                                ? __assign(__assign({}, item), { viewedAt: viewState_1.viewedAt, viewedByAdminId: viewState_1.viewedByAdminId }) : item;
                        });
                    });
                    setSelectedAppeal(function (current) {
                        return (current === null || current === void 0 ? void 0 : current.appealId) === viewState_1.appealId
                            ? __assign(__assign({}, current), { viewedAt: viewState_1.viewedAt, viewedByAdminId: viewState_1.viewedByAdminId }) : current;
                    });
                    setError(null);
                    onDataChanged === null || onDataChanged === void 0 ? void 0 : onDataChanged();
                    return [3 /*break*/, 4];
                case 3:
                    viewError_1 = _a.sent();
                    setAppeals(function (current) {
                        return current.map(function (item) {
                            return item.appealId === appeal.appealId
                                ? __assign(__assign({}, item), { viewedAt: appeal.viewedAt, viewedByAdminId: appeal.viewedByAdminId }) : item;
                        });
                    });
                    setSelectedAppeal(function (current) {
                        return (current === null || current === void 0 ? void 0 : current.appealId) === appeal.appealId
                            ? __assign(__assign({}, current), { viewedAt: appeal.viewedAt, viewedByAdminId: appeal.viewedByAdminId }) : current;
                    });
                    setError(String(viewError_1));
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
                case 5:
                    setSelectedAppeal(appeal);
                    return [2 /*return*/];
            }
        });
    }); };
    (0, react_1.useEffect)(function () {
        if (!selectedAppeal)
            return;
        var nextSelectedAppeal = appeals.find(function (appeal) { return appeal.appealId === selectedAppeal.appealId; });
        if (!nextSelectedAppeal) {
            setSelectedAppeal(null);
            return;
        }
        if (nextSelectedAppeal !== selectedAppeal) {
            setSelectedAppeal(nextSelectedAppeal);
        }
    }, [appeals, selectedAppeal]);
    (0, react_1.useEffect)(function () {
        if (!selectedReport)
            return;
        var nextSelectedReport = reports.find(function (report) { return report.reportId === selectedReport.reportId; });
        if (!nextSelectedReport) {
            setSelectedReport(null);
            return;
        }
        if (nextSelectedReport !== selectedReport) {
            setSelectedReport(nextSelectedReport);
        }
    }, [reports, selectedReport]);
    var hasOpenModal = selectedReport !== null || selectedAppeal !== null;
    (0, react_1.useEffect)(function () {
        if (!hasOpenModal)
            return;
        var previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        var handleKeyDown = function (event) {
            if (event.key === "Escape") {
                setSelectedReport(null);
                setSelectedAppeal(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return function () {
            document.body.style.overflow = previousBodyOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [hasOpenModal]);
    var handleSaveStatus = function (report) { return __awaiter(_this, void 0, void 0, function () {
        var nextStatus, updated_1, updateError_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    nextStatus = (_a = draftStatuses[report.reportId]) !== null && _a !== void 0 ? _a : report.status;
                    if (nextStatus === report.status)
                        return [2 /*return*/];
                    setBusyReportId(report.reportId);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, reports_1.updateAdminReportStatus)(accessToken, report.reportId, nextStatus)];
                case 2:
                    updated_1 = _b.sent();
                    setReports(function (current) {
                        return current.map(function (item) { return (item.reportId === updated_1.reportId ? updated_1 : item); });
                    });
                    setSelectedReport(function (current) {
                        return (current === null || current === void 0 ? void 0 : current.reportId) === updated_1.reportId ? updated_1 : current;
                    });
                    setDraftStatuses(function (current) {
                        var _a;
                        return (__assign(__assign({}, current), (_a = {}, _a[updated_1.reportId] = updated_1.status, _a)));
                    });
                    setError(null);
                    onDataChanged === null || onDataChanged === void 0 ? void 0 : onDataChanged();
                    return [3 /*break*/, 5];
                case 3:
                    updateError_1 = _b.sent();
                    setError(String(updateError_1));
                    return [3 /*break*/, 5];
                case 4:
                    setBusyReportId(null);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return (<section className="page-stack reports-page">
      <section className="page-panel reports-page__panel">
        <div className="reports-section-tabs" role="tablist" aria-label="Report views">
          <button type="button" className={"reports-section-tab".concat(activeSection === "reports" ? " reports-section-tab--active" : "")} onClick={function () { return setActiveSection("reports"); }} role="tab" aria-selected={activeSection === "reports"}>
            <span>Passenger Reports</span>
            <strong>{reports.length}</strong>
          </button>
          <button type="button" className={"reports-section-tab".concat(activeSection === "appeals" ? " reports-section-tab--active" : "")} onClick={function () { return setActiveSection("appeals"); }} role="tab" aria-selected={activeSection === "appeals"}>
            <span>Driver Appeals</span>
            <strong>{appeals.length}</strong>
            {activeAppealTabCount > 0 && <em>{activeAppealTabCount} new</em>}
          </button>
        </div>

        {activeSection === "reports" ? (<>
            <div className="reports-summary">
              {REPORT_STATUS_OPTIONS.map(function (status) { return (<article key={status} className="reports-summary__card">
                  <span>{formatReportStatus(status)}</span>
                  <strong>{counts[status]}</strong>
                </article>); })}
            </div>

            <div className="reports-toolbar">
              <input className="reports-toolbar__search" placeholder="Search report ID, driver, route, plate..." value={searchQuery} onChange={function (event) { return setSearchQuery(event.target.value); }} aria-label="Search reports"/>

              <select className="reports-toolbar__select" value={statusFilter} onChange={function (event) { return setStatusFilter(event.target.value); }} aria-label="Filter reports by status">
                <option value="all">All statuses</option>
                {REPORT_STATUS_OPTIONS.map(function (status) { return (<option key={status} value={status}>
                    {formatReportStatus(status)}
                  </option>); })}
              </select>

              <select className="reports-toolbar__select" value={typeFilter} onChange={function (event) { return setTypeFilter(event.target.value); }} aria-label="Filter reports by category">
                <option value="all">All categories</option>
                {reportTypes.map(function (type) { return (<option key={type.reportTypeId} value={type.code}>
                    {type.label}
                  </option>); })}
              </select>
            </div>
          </>) : (<>
            <div className="reports-summary">
              {APPEAL_SUMMARY_STATUS_OPTIONS.map(function (status) { return (<article key={status} className="reports-summary__card">
                  <span>{formatAppealStatus(status)}</span>
                  <strong>{appealCounts[status]}</strong>
                </article>); })}
            </div>

            <div className="reports-toolbar">
              <input className="reports-toolbar__search" placeholder="Search appeal ID, driver, violation, route..." value={searchQuery} onChange={function (event) { return setSearchQuery(event.target.value); }} aria-label="Search appeals"/>

              <select className="reports-toolbar__select" value={appealStatusFilter} onChange={function (event) {
                return setAppealStatusFilter(event.target.value);
            }} aria-label="Filter appeals by status">
                {APPEAL_STATUS_OPTIONS.map(function (status) { return (<option key={status} value={status}>
                    {status === "all" ? "All statuses" : formatAppealStatus(status)}
                  </option>); })}
              </select>

              <div className="reports-toolbar__summary">
                {activeAppealTabCount > 0
                ? "".concat(activeAppealTabCount, " new appeal").concat(activeAppealTabCount === 1 ? "" : "s")
                : "No new appeal alerts"}
              </div>
            </div>
          </>)}

        <div className="reports-content">
          {cacheNotice && <div className="reports-cache-notice">{cacheNotice}</div>}
          {error && <div className="reports-error">{error}</div>}

          {loading ? (<div className="muted">
              {activeSection === "reports"
                ? "Loading passenger reports..."
                : "Loading driver appeals..."}
            </div>) : activeSection === "reports" ? (filteredReports.length === 0 ? (<div className="muted">
                {reports.length === 0
                ? "No passenger reports have been submitted yet."
                : "No reports match the current filters."}
              </div>) : (<div className="reports-list">
                {filteredReports.map(function (report) {
                var _a, _b;
                return (<article key={report.reportId} className="reports-card reports-card--interactive" onClick={function () { return handleOpenReport(report); }} onKeyDown={function (event) {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleOpenReport(report);
                        }
                    }} tabIndex={0} role="button" aria-label={"Open report ".concat(report.reportId)}>
                      <div className="reports-card__top">
                        <div>
                          <div className="reports-card__titleRow">
                            <h3>{report.driverName}</h3>
                            <span className={"reports-status reports-status--".concat(report.status)}>
                              {formatReportStatus(report.status)}
                            </span>
                          </div>
                          <p>
                            {report.driverCode} | {(_a = report.plateNo) !== null && _a !== void 0 ? _a : "No tricycle"} | {report.todaName} |{" "}
                            {report.barangayName}
                          </p>
                        </div>
                        <div className="reports-card__meta">
                          <strong>Report #{report.reportId}</strong>
                          <span>{formatDateTime(report.reportedAt)}</span>
                        </div>
                      </div>

                      <div className="reports-card__badges">
                        <span className="reports-chip">{report.reportTypeLabel}</span>
                        <span className="reports-chip">{formatTripStatus(report.tripStatus)}</span>
                        {report.tripId && <span className="reports-chip">Trip #{report.tripId}</span>}
                        <span className="reports-chip">QR #{report.qrId}</span>
                        {report.violationId && (<span className="reports-chip">
                            Alert #{report.violationId}
                            {report.violationStatus
                            ? " (".concat(formatViolationStatus(report.violationStatus), ")")
                            : ""}
                          </span>)}
                      </div>

                      <div className="reports-card__route">
                        Route: {(_b = report.routeName) !== null && _b !== void 0 ? _b : "No route attached"}
                      </div>

                      <div className="reports-card__actions">
                        <div className="reports-card__appealMeta">
                          {report.passengerName
                        ? "Passenger: ".concat(report.passengerName)
                        : "Passenger: Anonymous"}
                        </div>
                        <span className="reports-card__button" aria-hidden="true">
                          View report
                        </span>
                      </div>
                    </article>);
            })}
              </div>)) : filteredAppeals.length === 0 ? (<div className="muted">
              {appeals.length === 0
                ? "No driver appeals have been submitted yet."
                : "No appeals match the current filters."}
            </div>) : (<div className="reports-list">
              {filteredAppeals.map(function (appeal) {
                var _a, _b;
                return (<article key={appeal.appealId} className="reports-card reports-card--interactive" onClick={function () { return void handleOpenAppeal(appeal); }} onKeyDown={function (event) {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            void handleOpenAppeal(appeal);
                        }
                    }} tabIndex={0} role="button" aria-label={"Open appeal ".concat(appeal.appealId)}>
                  <div className="reports-card__top">
                    <div>
                      <div className="reports-card__titleRow">
                        <h3>{appeal.driverName}</h3>
                        <span className={"reports-status reports-status--".concat(appeal.status)}>
                          {formatAppealStatus(appeal.status)}
                        </span>
                      </div>
                      <p>
                        {appeal.driverCode} | {(_a = appeal.plateNo) !== null && _a !== void 0 ? _a : "No tricycle"} | {appeal.todaName} |{" "}
                        {appeal.barangayName}
                      </p>
                    </div>
                    <div className="reports-card__meta">
                      <strong>Appeal</strong>
                      <span>{formatDateTime(appeal.submittedAt)}</span>
                    </div>
                  </div>

                  <div className="reports-card__badges">
                    <span className="reports-chip">{appeal.violationTypeLabel}</span>
                    <span className="reports-chip">Appeal: {appeal.appealReason}</span>
                    <span className="reports-chip">
                      Violation {formatViolationStatus(appeal.violationStatus)}
                    </span>
                    {appeal.tripId && <span className="reports-chip">Trip #{appeal.tripId}</span>}
                  </div>

                  <div className="reports-card__route">
                    Route: {(_b = appeal.routeName) !== null && _b !== void 0 ? _b : "No route attached"}
                  </div>
                  <div className="reports-card__route">
                    Submitted: {formatDateTime(appeal.submittedAt)}
                  </div>
                  <div className="reports-card__description">
                    {truncateText(appeal.appealMessage, 120)}
                  </div>

                  <div className="reports-card__actions">
                    <div className="reports-card__appealMeta">
                      Violation time: {formatDateTime(appeal.violationOccurredAt)}
                    </div>
                    <span className="reports-card__button" aria-hidden="true">
                      View appeal
                    </span>
                  </div>
                </article>);
            })}
            </div>)}
        </div>
      </section>

      {selectedReport && (<div className="reports-modal-backdrop" role="presentation" onClick={closeModals}>
          <section className="reports-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title" onClick={function (event) { return event.stopPropagation(); }}>
            <div className="reports-modal__header">
              <div>
                <p className="reports-modal__eyebrow">Passenger report</p>
                <h3 id="report-modal-title">{selectedReport.driverName}</h3>
              </div>
              <button type="button" className="reports-modal__close" onClick={closeModals}>
                Close
              </button>
            </div>

            <div className="reports-modal__body">
              <div className="reports-card__badges">
                <span className="reports-chip">{selectedReport.reportTypeLabel}</span>
                <span className="reports-chip">{formatTripStatus(selectedReport.tripStatus)}</span>
                <span className={"reports-status reports-status--".concat(selectedReport.status)}>
                  {formatReportStatus(selectedReport.status)}
                </span>
              </div>

              <div className="reports-modal__grid">
                <div>
                  <span>Report ID</span>
                  <strong>#{selectedReport.reportId}</strong>
                </div>
                <div>
                  <span>Reported at</span>
                  <strong>{formatDateTime(selectedReport.reportedAt)}</strong>
                </div>
                <div>
                  <span>Driver code</span>
                  <strong>{selectedReport.driverCode}</strong>
                </div>
                <div>
                  <span>Plate / unit</span>
                  <strong>{(_b = selectedReport.plateNo) !== null && _b !== void 0 ? _b : "No tricycle assigned"}</strong>
                </div>
                <div>
                  <span>TODA</span>
                  <strong>{selectedReport.todaName}</strong>
                </div>
                <div>
                  <span>Barangay</span>
                  <strong>{selectedReport.barangayName}</strong>
                </div>
                <div>
                  <span>Route</span>
                  <strong>{(_c = selectedReport.routeName) !== null && _c !== void 0 ? _c : "No route attached"}</strong>
                </div>
                <div>
                  <span>Passenger</span>
                  <strong>
                    {(_d = selectedReport.passengerName) !== null && _d !== void 0 ? _d : "Anonymous"}
                    {selectedReport.passengerContact ? " | ".concat(selectedReport.passengerContact) : ""}
                  </strong>
                </div>
              </div>

              <div className="reports-modal__section">
                <span className="reports-card__mediaLabel">Description</span>
                <div className="reports-card__description">{selectedReport.description}</div>
              </div>

              <div className="reports-modal__section">
                <span className="reports-card__mediaLabel">Uploaded proof</span>
                {selectedReport.mediaUrls && selectedReport.mediaUrls.length > 0 ? (<div className="reports-card__mediaGrid">
                    {selectedReport.mediaUrls.map(function (mediaUrl, index) { return (<a key={"".concat(selectedReport.reportId, "-").concat(index)} className="reports-card__mediaLink" href={mediaUrl} target="_blank" rel="noreferrer">
                        <img className="reports-card__mediaImage" src={mediaUrl} alt={"Uploaded proof ".concat(index + 1, " for report ").concat(selectedReport.reportId)} loading="lazy"/>
                      </a>); })}
                  </div>) : (<div className="reports-card__route">No uploaded proof for this report.</div>)}
              </div>

              <div className="reports-modal__section">
                <span className="reports-card__mediaLabel">Status</span>
                <div className="reports-modal__actions">
                  <select className="reports-toolbar__select" value={(_e = draftStatuses[selectedReport.reportId]) !== null && _e !== void 0 ? _e : selectedReport.status} onChange={function (event) {
                return setDraftStatuses(function (current) {
                    var _a;
                    return (__assign(__assign({}, current), (_a = {}, _a[selectedReport.reportId] = event.target.value, _a)));
                });
            }} disabled={busyReportId === selectedReport.reportId} aria-label={"Update status for report ".concat(selectedReport.reportId)}>
                    {REPORT_STATUS_OPTIONS.map(function (status) { return (<option key={status} value={status}>
                        {formatReportStatus(status)}
                      </option>); })}
                  </select>
                  <button type="button" className="reports-card__button" onClick={function () { return void handleSaveStatus(selectedReport); }} disabled={busyReportId === selectedReport.reportId ||
                ((_f = draftStatuses[selectedReport.reportId]) !== null && _f !== void 0 ? _f : selectedReport.status) ===
                    selectedReport.status}>
                    {busyReportId === selectedReport.reportId ? "Saving..." : "Save status"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>)}

      {selectedAppeal && (<div className="reports-modal-backdrop" role="presentation" onClick={closeModals}>
          <section className="reports-modal" role="dialog" aria-modal="true" aria-labelledby="appeal-modal-title" onClick={function (event) { return event.stopPropagation(); }}>
            <div className="reports-modal__header">
              <div>
                <p className="reports-modal__eyebrow">Driver Appeal</p>
                <h3 id="appeal-modal-title">{selectedAppeal.driverName}</h3>
              </div>
              <button type="button" className="reports-modal__close" onClick={closeModals}>
                Close
              </button>
            </div>

            <div className="reports-modal__body">
              <div className="reports-card__badges">
                <span className="reports-chip">{selectedAppeal.violationTypeLabel}</span>
                <span className="reports-chip">Appeal: {selectedAppeal.appealReason}</span>
                <span className={"reports-status reports-status--".concat(selectedAppeal.status)}>
                  {formatAppealStatus(selectedAppeal.status)}
                </span>
              </div>

              <div className="reports-modal__grid">
                <div>
                  <span>Driver Code</span>
                  <strong>{selectedAppeal.driverCode}</strong>
                </div>
                <div>
                  <span>Plate / Unit</span>
                  <strong>{(_g = selectedAppeal.plateNo) !== null && _g !== void 0 ? _g : "No tricycle assigned"}</strong>
                </div>
                <div>
                  <span>Submitted</span>
                  <strong>{formatDateTime(selectedAppeal.submittedAt)}</strong>
                </div>
                <div>
                  <span>Violation Status</span>
                  <strong>{formatViolationStatus(selectedAppeal.violationStatus)}</strong>
                </div>
                <div>
                  <span>TODA</span>
                  <strong>{selectedAppeal.todaName}</strong>
                </div>
                <div>
                  <span>Route</span>
                  <strong>{(_h = selectedAppeal.routeName) !== null && _h !== void 0 ? _h : "No route attached"}</strong>
                </div>
              </div>

              <div className="reports-modal__section">
                <span className="reports-card__mediaLabel">Appeal message</span>
                <div className="reports-card__description">
                  {(_j = selectedAppeal.appealMessage) !== null && _j !== void 0 ? _j : "No appeal message provided."}
                </div>
              </div>

              <div className="reports-modal__section">
                <span className="reports-card__mediaLabel">Proof image</span>
                {((_k = selectedAppeal.proofImageUrls) === null || _k === void 0 ? void 0 : _k.length) > 0 ? (<div className="reports-card__mediaGrid">
                    {selectedAppeal.proofImageUrls.map(function (proofUrl, index) { return (<a key={"".concat(selectedAppeal.appealId, "-").concat(index)} className="reports-card__mediaLink" href={proofUrl} target="_blank" rel="noreferrer">
                        <img className="reports-card__mediaImage" src={proofUrl} alt={"Proof ".concat(index + 1, " for ").concat(selectedAppeal.driverName)} loading="lazy"/>
                      </a>); })}
                  </div>) : (<div className="reports-card__route">No proof image uploaded for this appeal.</div>)}
              </div>
            </div>
          </section>
        </div>)}
    </section>);
}
