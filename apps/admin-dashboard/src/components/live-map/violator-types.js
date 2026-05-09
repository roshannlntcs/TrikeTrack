"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortViolatorsByRecency = exports.getViolatorTimestampMs = void 0;
var getViolatorTimestampMs = function (violator) {
    return new Date(violator.timestamp).getTime();
};
exports.getViolatorTimestampMs = getViolatorTimestampMs;
var sortViolatorsByRecency = function (a, b) {
    return (0, exports.getViolatorTimestampMs)(b) - (0, exports.getViolatorTimestampMs)(a) ||
        a.driverName.localeCompare(b.driverName);
};
exports.sortViolatorsByRecency = sortViolatorsByRecency;
