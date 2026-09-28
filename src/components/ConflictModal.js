// ConflictModal.js
// Phase 5: Shown when a write conflict is detected.
// Non-blocking — user can dismiss by clicking backdrop,
// pressing Escape, or clicking "Tutup".
// Auto-dismisses after 8 seconds.

import React, { useEffect } from 'react';

/**
 * T111: `message` and `autoDismiss` are optional and default to the original
 * behaviour, so existing callers (editTransaction, updateContact) are unchanged.
 * A payment conflict passes autoDismiss=false — money must not disappear behind
 * a popup that times out after 8 seconds while the user is looking elsewhere.
 *
 * @param {{
 *   updatedBy: string,
 *   onClose: () => void,
 *   message?: string,
 *   autoDismiss?: boolean
 * }} props
 */
export default function ConflictModal({ updatedBy, onClose, message, autoDismiss = true }) {
  // Auto-dismiss after 8 seconds (skipped when autoDismiss is false)
  useEffect(() => {
    if (!autoDismiss) return;
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [onClose, autoDismiss]);

  // Escape key dismisses (kept even when autoDismiss is off — the user can
  // always close it deliberately; only the silent timeout is suppressed)
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 1100 }}
    >
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420 }}
      >
        <div className="modal-title" style={{ color: '#f59e0b' }}>
          ⚠ Data Telah Diubah
        </div>
        <div className="modal-body">
          {message ? (
            <p>{message}</p>
          ) : (
            <>
              <p>
                Data ini sudah diubah oleh{' '}
                <strong>{updatedBy}</strong>.
                Perubahan Anda tidak disimpan.
              </p>
              <p style={{ marginTop: 8 }}>
                Silakan refresh halaman untuk melihat data terbaru.
              </p>
            </>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
