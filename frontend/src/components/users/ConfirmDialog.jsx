import { AlertTriangle } from 'lucide-react';

import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';

/**
 * Small confirmation dialog. Used before activating/deactivating an account.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      title={title}
      size="sm"
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <LoadingSpinner inline /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
        <span className={`confirm-icon ${tone}`} aria-hidden="true">
          <AlertTriangle size={18} />
        </span>
        <p className="text-secondary" style={{ marginTop: 2 }}>
          {message}
        </p>
      </div>
    </Modal>
  );
}
