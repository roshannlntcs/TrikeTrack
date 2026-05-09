"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatAssignedTricycle = exports.formatTricycleUnitId = void 0;
var formatTricycleUnitId = function (tricycleId) {
    return "T-".concat(String(tricycleId).padStart(3, "0"));
};
exports.formatTricycleUnitId = formatTricycleUnitId;
var formatAssignedTricycle = function (_a) {
    var tricycleId = _a.tricycleId, tricycleNo = _a.tricycleNo;
    if (typeof tricycleId === "number" && tricycleId > 0) {
        return (0, exports.formatTricycleUnitId)(tricycleId);
    }
    return tricycleNo !== null && tricycleNo !== void 0 ? tricycleNo : "Unassigned";
};
exports.formatAssignedTricycle = formatAssignedTricycle;
