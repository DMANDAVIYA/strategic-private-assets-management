import { Link } from "@tanstack/react-router";
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

const NAV_ITEM_CLASS = "flex min-h-11 items-center rounded-lg px-2.5 py-[7px] sm:min-h-0";

type NavLinksProps = { onNavigate?: () => void };

export function NavLinks({ onNavigate }: NavLinksProps) {
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
            onClick={onNavigate}
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

export function CheckInButton() {
  return (
    <Button className="mt-auto w-full py-[9px] text-[0.82rem]" disabled title="Coming in a later phase">
      Tonight's check-in
    </Button>
  );
}
