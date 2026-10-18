import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuthStatus, useLogout } from "../api/auth";
import { formatHeaderDate } from "../lib/format";
import { Button } from "./Button";

type NavItem = { label: string; to?: "/" | "/settings/access" };

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { label: "Overview", to: "/" },
  { label: "Check-in" },
  { label: "Ledger" },
  { label: "Accounts" },
  { label: "Loans" },
  { label: "Holdings" },
  { label: "Budgets" },
  { label: "Recurring" },
  { label: "Reports" },
  { label: "Settings", to: "/settings/access" },
];

const NAV_ITEM_CLASS = "rounded-lg px-2.5 py-[7px]";

function NavLinks() {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) =>
        item.to === undefined ? (
          <span key={item.label} aria-disabled="true" className={`${NAV_ITEM_CLASS} text-faint`}>
            {item.label}
          </span>
        ) : (
          <Link
            key={item.label}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            className={`${NAV_ITEM_CLASS} hover:text-text`}
            activeProps={{ className: "bg-panel font-semibold text-text" }}
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}

function CurrencyToggle() {
  return (
    <div
      inert
      role="group"
      aria-label="Display currency"
      className="flex overflow-hidden rounded-lg border border-hairline text-[0.75rem]"
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

type AppShellProps = {
  title: string;
  children: ReactNode;
};

export function AppShell({ title, children }: AppShellProps) {
  const { data: status } = useAuthStatus();
  const logout = useLogout();
  const navigate = useNavigate();

  function logOut() {
    logout.mutate(undefined, { onSuccess: () => void navigate({ to: "/login" }) });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-[188px] shrink-0 flex-col gap-0.5 border-r border-hairline px-3 py-4 text-[0.84rem] text-muted">
        <div className="px-2.5 pb-3.5 pt-1 text-[0.95rem] font-bold text-text">financeper</div>
        <NavLinks />
        <Button className="mt-auto w-full py-[9px] text-[0.82rem]" disabled title="Coming in a later phase">
          Tonight's check-in
        </Button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] items-center gap-[18px] border-b border-hairline px-[22px] text-[0.85rem] text-muted">
          <h1 className="text-[0.95rem] font-semibold text-text">{title}</h1>
          <span className="text-faint">{formatHeaderDate()}</span>
          <span className="flex-1" />
          <CurrencyToggle />
          <span className="text-text">{status?.user?.displayName}</span>
          <Button variant="ghost" className="px-3 py-1.5 text-[0.8rem]" onClick={logOut} disabled={logout.isPending}>
            Log out
          </Button>
        </header>
        <main className="flex-1 px-[22px] pb-[22px] pt-[18px]">{children}</main>
      </div>
    </div>
  );
}
