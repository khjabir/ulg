"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./Icons";
import { holdBack } from "./nav";

type Props = { open: boolean; onClose: () => void; title?: string; label: string; className?: string; children: ReactNode };

export function Dialog({ open, onClose, title, label, className = "", children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  // The phone's Back button closes the dialog, like in an app.
  useEffect(() => {
    if (!open) return;
    return holdBack(() => closeRef.current());
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className={`dialog-body ${className}`}>
        {title && (
          <div className="dialog-head">
            <h2>{title}</h2>
            <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}
