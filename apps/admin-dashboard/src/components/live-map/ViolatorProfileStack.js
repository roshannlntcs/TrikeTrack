"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ViolatorProfileStack;
var ViolatorAvatar_1 = require("./ViolatorAvatar");
var MAX_STACK_AVATARS = 6;
function ViolatorProfileStack(_a) {
    var violators = _a.violators, selectedDriverKey = _a.selectedDriverKey, onSelect = _a.onSelect, onDismiss = _a.onDismiss;
    if (violators.length === 0)
        return null;
    var visibleViolators = violators.length > MAX_STACK_AVATARS
        ? violators.slice(0, MAX_STACK_AVATARS)
        : violators;
    var hiddenViolatorCount = Math.max(0, violators.length - MAX_STACK_AVATARS);
    return (<aside className="violator-stack" aria-label="Active outside geofence violators">
      <div className="violator-stack__rail">
        {visibleViolators.map(function (violator) { return (<ViolatorAvatar_1.default key={violator.driverKey} violator={violator} selected={selectedDriverKey === violator.driverKey} onSelect={onSelect} onDismiss={onDismiss}/>); })}
        {hiddenViolatorCount > 0 && (<div className="violator-avatar violator-avatar--overflow" aria-label={"".concat(hiddenViolatorCount, " more active violators")} title={"".concat(hiddenViolatorCount, " more active violators")}>
            <div className="violator-avatar__frame">
              <span className="violator-avatar__overflow-count">+{hiddenViolatorCount}</span>
            </div>
          </div>)}
      </div>
    </aside>);
}
