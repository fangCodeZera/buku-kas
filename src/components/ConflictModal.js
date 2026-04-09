// ConflictModal.js
// Phase 5: Shown when a write conflict is detected.
// Non-blocking — user can dismiss by clicking backdrop,
// pressing Escape, or clicking "Tutup".
// Auto-dismisses after 8 seconds.

import React, { useEffect } from 'react';

/**
 * @param {{
 *   updatedBy: string,
 *   onClose: () => void
 * }} props
 */
export default function ConflictModal({ updatedBy, onClose }) {
  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);

  // Escape key dismisses
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
          <p>
            Data ini sudah diubah oleh{' '}
            <strong>{updatedBy}</strong>.
            Perubahan Anda tidak disimpan.
          </p>
          <p style={{ marginTop: 8 }}>
            Silakan refresh halaman untuk melihat data terbaru.
          </p>
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
