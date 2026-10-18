import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuthStatus, useLogout } from "../src/api/auth";
import { AppShell } from "../src/components/AppShell";
import { mutationStub, queryStub, renderPage } from "./helpers";

vi.mock("../src/api/auth", () => ({ useAuthStatus: vi.fn(), useLogout: vi.fn() }));

type AuthQuery = ReturnType<typeof useAuthStatus>;
type LogoutMutation = ReturnType<typeof useLogout>;

const NAV_LABELS = [
  "Overview",
  "Check-in",
  "Ledger",
  "Accounts",
  "Loans",
  "Holdings",
  "Budgets",
  "Recurring",
  "Reports",
  "Settings",
];

function ShellPage() {
  return (
    <AppShell title="Overview">
      <p>Body</p>
    </AppShell>
  );
}

function menuButton() {
  return screen.getByRole("button", { name: "Open navigation" });
}

function navigationDialog() {
  return screen.getByRole("dialog", { name: "Navigation" });
}

beforeEach(() => {
  vi.mocked(useAuthStatus).mockReturnValue(
    queryStub<AuthQuery>({
      data: { setupRequired: false, authenticated: true, user: { id: 1, email: "a@b.co", displayName: "Alex" } },
    }),
  );
  vi.mocked(useLogout).mockReturnValue(mutationStub<LogoutMutation>());
});

test("the menu button starts collapsed with the navigation dialog closed", async () => {
  await renderPage(ShellPage);
  expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  expect(menuButton()).toHaveAttribute("aria-controls");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("opening the menu shows a modal navigation dialog with the nav items and moves focus into it", async () => {
  const user = userEvent.setup();
  await renderPage(ShellPage);
  await user.click(menuButton());
  const dialog = navigationDialog();
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(dialog.id).toBe(menuButton().getAttribute("aria-controls"));
  expect(menuButton()).toHaveAttribute("aria-expanded", "true");
  const items = within(dialog).getByRole("navigation", { name: "Main" });
  expect(Array.from(items.children).map((child) => child.textContent)).toEqual(NAV_LABELS);
  expect(within(dialog).getByRole("button", { name: "Tonight's check-in" })).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "Close navigation" })).toBeInTheDocument();
  expect(dialog.contains(document.activeElement)).toBe(true);
});

test("escape closes the dialog and returns focus to the menu button", async () => {
  const user = userEvent.setup();
  await renderPage(ShellPage);
  await user.click(menuButton());
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  expect(menuButton()).toHaveFocus();
});

test("the close button closes the dialog and returns focus to the menu button", async () => {
  const user = userEvent.setup();
  await renderPage(ShellPage);
  await user.click(menuButton());
  await user.click(within(navigationDialog()).getByRole("button", { name: "Close navigation" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(menuButton()).toHaveFocus();
});

test("selecting a navigation item closes the dialog", async () => {
  const user = userEvent.setup();
  await renderPage(ShellPage);
  await user.click(menuButton());
  await user.click(within(navigationDialog()).getByRole("link", { name: "Overview" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(menuButton()).toHaveAttribute("aria-expanded", "false");
});

test("the sidebar navigation stays in the document beside the dialog", async () => {
  const user = userEvent.setup();
  await renderPage(ShellPage);
  const sidebar = screen.getByRole("complementary");
  expect(within(sidebar).getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  await user.click(menuButton());
  expect(screen.getAllByRole("navigation", { name: "Main" })).toHaveLength(2);
  expect(within(sidebar).getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
});
