"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./Icons";

type Props = { open: boolean; onClose: () => void; title?: string; label: string; className?: string; children: ReactNode };

export function Dialog({ open, onClose, title, label, className = "", children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && d.open) d.close();
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
