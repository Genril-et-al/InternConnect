import { useEffect, useRef } from 'react'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Styles the confirm button as a destructive action (red). */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Small accessible confirmation modal, reusing the app's modal overlay styling.
 * Closes on Escape or a click on the backdrop, and focuses the cancel button on
 * open so the default action is the safe one.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="modal-overlay"
      onClick={onCancel}
      role="presentation"
    >
      <div
        aria-labelledby="confirm-title"
        aria-modal="true"
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
      >
        <h3 className="confirm-title" id="confirm-title">
          {title}
        </h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button
            className="confirm-cancel"
            onClick={onCancel}
            ref={cancelRef}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={danger ? 'confirm-ok danger' : 'confirm-ok'}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
