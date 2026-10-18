import { useEffect, useRef } from "react";
import { CheckInButton, NavLinks } from "./NavLinks";

type NavOverlayProps = {
  id: string;
  open: boolean;
  onClose: () => void;
};

export function NavOverlay({ id, open, onClose }: NavOverlayProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      closeRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div id={id} role="dialog" aria-modal="true" aria-label="Navigation" className="fixed inset-0 z-50 flex sm:hidden">
      <div className="absolute inset-0 bg-ground/70" onClick={onClose} />
      <div className="relative flex h-full w-[280px] max-w-[85vw] flex-col gap-0.5 border-r border-hairline bg-ground px-3 py-4 text-[0.84rem] text-muted">
        <div className="flex items-center justify-between pb-3.5 pl-2.5 pt-1">
          <span className="text-[0.95rem] font-bold text-text">financeper</span>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-lg text-text hover:bg-panel"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
        <NavLinks onNavigate={onClose} />
        <CheckInButton />
      </div>
    </div>
  );
}
