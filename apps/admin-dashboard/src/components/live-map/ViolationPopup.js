"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ViolationPopup;
var formatViolationTimestamp = function (timestamp) {
    var parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? timestamp : parsed.toLocaleString();
};
var formatLastSeen = function (lastSeenTs) {
    if (!lastSeenTs)
        return null;
    var parsed = new Date(lastSeenTs);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleString();
};
function ViolationPopup(_a) {
    var violator = _a.violator, position = _a.position, onClose = _a.onClose;
    return (<section className={"violation-popup violation-popup--".concat(position.align)} style={{
            left: "".concat(position.x, "px"),
            top: "".concat(position.y, "px")
        }} aria-live="polite">
      <div className="violation-popup__eyebrow">Outside geofence</div>
      <button type="button" className="violation-popup__close" onClick={onClose} aria-label="Close violation details">
        Close
      </button>
      <strong className="violation-popup__name">{violator.driverName}</strong>
      <div className="violation-popup__meta">Driver ID: {violator.driverId}</div>
      <div className="violation-popup__meta">{formatViolationTimestamp(violator.timestamp)}</div>
      {violator.driverOnlineStatus === "offline" && (<div className="violation-popup__meta">
          Offline
          {formatLastSeen(violator.lastSeenTs)
                ? " | Last seen ".concat(formatLastSeen(violator.lastSeenTs))
                : ""}
        </div>)}
    </section>);
}
