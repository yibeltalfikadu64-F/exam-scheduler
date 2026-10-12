import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible modal shell used by the user-management dialogs.
 *
 * - Closes on Escape and on a backdrop click.
 * - Traps nothing fancy (no focus library in the stack) but sets the usual
 *   dialog semantics and an aria-label for screen readers.
 */
export default function Modal({ title, subtitle, onClose, children, footer = null, size = 'md' }) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{title}</h3>
            {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
          </div>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close dialog" title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">{children}</div>

        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
