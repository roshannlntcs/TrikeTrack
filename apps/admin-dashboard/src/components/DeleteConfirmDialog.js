"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DeleteConfirmDialog;
require("./DeleteConfirmDialog.css");
function DeleteConfirmDialog(_a) {
    var open = _a.open, title = _a.title, description = _a.description, _b = _a.busy, busy = _b === void 0 ? false : _b, _c = _a.confirmLabel, confirmLabel = _c === void 0 ? "Delete" : _c, onClose = _a.onClose, onConfirm = _a.onConfirm;
    if (!open)
        return null;
    return (<div className="delete-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" onClick={function (event) { return event.stopPropagation(); }}>
        <div className="delete-dialog__header">
          <div className="delete-dialog__icon" aria-hidden="true">
            !
          </div>
          <div className="delete-dialog__content">
            <h3 id="delete-dialog-title">{title}</h3>
            <p>{description}</p>
            <p className="delete-dialog__warning">This action cannot be undone.</p>
          </div>
        </div>
        <div className="delete-dialog__footer">
          <button type="button" className="delete-dialog__secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="delete-dialog__danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>);
}
