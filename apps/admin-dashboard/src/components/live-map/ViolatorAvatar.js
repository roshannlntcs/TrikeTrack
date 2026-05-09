"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ViolatorAvatar;
var react_1 = require("react");
var getViolatorInitials = function (driverName) {
    var parts = driverName
        .split(/\s+/)
        .map(function (part) { return part.trim(); })
        .filter(Boolean);
    var initials = parts.slice(0, 2).map(function (part) { return part.charAt(0).toUpperCase(); });
    return initials.join("") || "D";
};
function ViolatorAvatar(_a) {
    var _b;
    var violator = _a.violator, selected = _a.selected, onSelect = _a.onSelect, onDismiss = _a.onDismiss;
    var _c = (0, react_1.useState)(false), imageFailed = _c[0], setImageFailed = _c[1];
    var showImage = Boolean(violator.avatarUrl) && !imageFailed;
    return (<div className={"violator-avatar ".concat(selected ? "violator-avatar--selected" : "")}>
      <button type="button" className="violator-avatar__button" onClick={function () { return onSelect(violator); }} aria-pressed={selected} aria-label={"Focus ".concat(violator.driverName, " outside geofence violation")} title={"".concat(violator.driverName, " | ").concat(violator.driverId)}>
        <span className="violator-avatar__frame">
          {showImage ? (<img src={(_b = violator.avatarUrl) !== null && _b !== void 0 ? _b : undefined} alt={violator.driverName} onError={function () { return setImageFailed(true); }}/>) : (<span className="violator-avatar__fallback" aria-hidden="true">
              {getViolatorInitials(violator.driverName)}
            </span>)}
        </span>
        <span className="violator-avatar__badge" aria-hidden="true">
          !
        </span>
      </button>
      <button type="button" className="violator-avatar__dismiss" onClick={function (event) {
            event.preventDefault();
            event.stopPropagation();
            onDismiss(violator);
        }} aria-label={"Dismiss ".concat(violator.driverName, " violator profile")} title={"Dismiss ".concat(violator.driverName)}>
        x
      </button>
    </div>);
}
