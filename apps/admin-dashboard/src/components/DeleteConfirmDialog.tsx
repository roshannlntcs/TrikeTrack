import "./DeleteConfirmDialog.css"

type DeleteConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  busy?: boolean
  confirmLabel?: string
  onClose: () => void
  onConfirm: () => void
}

export default function DeleteConfirmDialog({
  open,
  title,
  description,
  busy = false,
  confirmLabel = "Delete",
  onClose,
  onConfirm
}: DeleteConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="delete-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="delete-dialog__icon" aria-hidden="true">
          !
        </div>
        <div className="delete-dialog__content">
          <h3 id="delete-dialog-title">{title}</h3>
          <p>{description}</p>
          <p className="delete-dialog__warning">This action cannot be undone.</p>
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
    </div>
  )
}
