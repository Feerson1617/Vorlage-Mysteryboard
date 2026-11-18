import { useEffect, useRef, type ReactNode } from "react";
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    ref.current!.showModal();
    return () => {
      ref.current?.close();
      old?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Schließen"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
