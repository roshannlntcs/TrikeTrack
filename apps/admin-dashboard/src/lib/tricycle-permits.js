"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPermitExpiryState = exports.getDefaultPermitExpirationDate = void 0;
var MTOP_VALIDITY_YEARS = 2;
var formatDateInput = function (value) {
    var year = value.getFullYear();
    var month = String(value.getMonth() + 1).padStart(2, "0");
    var day = String(value.getDate()).padStart(2, "0");
    return "".concat(year, "-").concat(month, "-").concat(day);
};
var parseDateInput = function (value) {
    if (!value)
        return null;
    var _a = value.split("-").map(Number), year = _a[0], month = _a[1], day = _a[2];
    if (!year || !month || !day)
        return null;
    return new Date(year, month - 1, day);
};
var getDefaultPermitExpirationDate = function (baseDate) {
    if (baseDate === void 0) { baseDate = new Date(); }
    var next = new Date(baseDate);
    next.setFullYear(next.getFullYear() + MTOP_VALIDITY_YEARS);
    return formatDateInput(next);
};
exports.getDefaultPermitExpirationDate = getDefaultPermitExpirationDate;
var getPermitExpiryState = function (permitExpirationDate, now) {
    if (now === void 0) { now = new Date(); }
    var parsed = parseDateInput(permitExpirationDate);
    if (!parsed) {
        return {
            status: "missing",
            label: "No permit expiry set",
            expiresAtTs: null
        };
    }
    var expiresAt = new Date(parsed);
    expiresAt.setHours(23, 59, 59, 999);
    if (expiresAt.getTime() < now.getTime()) {
        return {
            status: "expired",
            label: "Expired on ".concat(parsed.toLocaleDateString()),
            expiresAtTs: expiresAt.getTime()
        };
    }
    return {
        status: "valid",
        label: "Valid until ".concat(parsed.toLocaleDateString()),
        expiresAtTs: expiresAt.getTime()
    };
};
exports.getPermitExpiryState = getPermitExpiryState;
