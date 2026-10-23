/**
 * A confirm step for a consequential, hard-to-reverse action. Escape cancels,
 * focus lands on the confirm button. A dialog genuinely floats, so it is one of
 * the few surfaces allowed a shadow.
 */
import { useEffect, useRef } from "react";
import { Button } from "./Button";

const dialogCard = "w-full max-w-md rounded-card border border-edge bg-surface p-5 shadow-xl"; // taste-skill-ignore: a dialog genuinely floats

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className={dialogCard}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-section font-medium text-ink">
          {title}
        </h2>
        <div id="confirm-body" className="mt-1.5 text-body text-muted">
          {body}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button ref={confirmRef} variant="primary" size="sm" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
