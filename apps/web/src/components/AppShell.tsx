import { useNavigate } from "@tanstack/react-router";
import { useId, useRef, useState, type ReactNode, type Ref } from "react";
import { useAuthStatus, useLogout } from "../api/auth";
import { formatHeaderDate } from "../lib/format";
import { Button } from "./Button";
import { CheckInButton, NavLinks } from "./NavLinks";
import { NavOverlay } from "./NavOverlay";

function CurrencyToggle() {
  return (
    <div
      inert
      role="group"
      aria-label="Display currency"
      className="ml-auto flex overflow-hidden rounded-lg border border-hairline text-[0.75rem] sm:ml-0"
    >
      <button type="button" aria-pressed="true" className="bg-hairline px-2.5 py-1 text-text">
        USD
      </button>
      <button type="button" aria-pressed="false" className="px-2.5 py-1 text-muted">
        INR
      </button>
    </div>
  );
}

type MenuButtonProps = {
  ref: Ref<HTMLButtonElement>;
  expanded: boolean;
  controls: string;
  onClick: () => void;
};

function MenuButton({ ref, expanded, controls, onClick }: MenuButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label="Open navigation"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-lg text-text hover:bg-panel sm:hidden"
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
        <path d="M3 5.5h14M3 10h14M3 14.5h14" />
      </svg>
    </button>
  );
}

type AppShellProps = {
  title: string;
  children: ReactNode;
};

export function AppShell({ title, children }: AppShellProps) {
  const { data: status } = useAuthStatus();
  const logout = useLogout();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const overlayId = useId();

  function logOut() {
    logout.mutate(undefined, { onSuccess: () => void navigate({ to: "/login" }) });
  }

  function closeNav() {
    setNavOpen(false);
    menuRef.current?.focus();
  }

  return (
    <div className="flex min-h-screen pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <aside className="hidden w-[188px] shrink-0 flex-col gap-0.5 border-r border-hairline px-3 py-4 text-[0.84rem] text-muted sm:flex">
        <div className="px-2.5 pb-3.5 pt-1 text-[0.95rem] font-bold text-text">financeper</div>
        <NavLinks />
        <CheckInButton />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-hairline pt-[env(safe-area-inset-top)] text-[0.85rem] text-muted sm:flex sm:h-[52px] sm:items-center sm:gap-[18px] sm:px-[22px]">
          <div className="flex h-[52px] items-center gap-2 pl-1 pr-4 sm:contents">
            <MenuButton ref={menuRef} expanded={navOpen} controls={overlayId} onClick={() => setNavOpen(true)} />
            <span className="text-[0.95rem] font-bold text-text sm:hidden">financeper</span>
            <span className="flex-1 sm:hidden" />
            <Button
              variant="ghost"
              className="px-3 py-1.5 sm:order-last sm:text-[0.8rem]"
              onClick={logOut}
              disabled={logout.isPending}
            >
              Log out
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pb-3 sm:contents">
            <h1 className="text-[0.95rem] font-semibold text-text">{title}</h1>
            <span className="text-faint">{formatHeaderDate()}</span>
            <span className="hidden flex-1 sm:block" />
            <CurrencyToggle />
            <span className="text-text">{status?.user?.displayName}</span>
          </div>
        </header>
        <main className="flex-1 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-[22px] sm:pb-[calc(22px+env(safe-area-inset-bottom))] sm:pt-[18px]">{children}</main>
      </div>
      <NavOverlay id={overlayId} open={navOpen} onClose={closeNav} />
    </div>
  );
}
