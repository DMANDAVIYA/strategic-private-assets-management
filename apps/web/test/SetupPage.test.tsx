import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSetup } from "../src/api/auth";
import { ApiError } from "../src/api/client";
import { SetupPage } from "../src/routes/SetupPage";
import { mutationStub, renderPage } from "./helpers";

vi.mock("../src/api/auth", () => ({ useSetup: vi.fn() }));

type SetupMutation = ReturnType<typeof useSetup>;

async function fillForm(values: { email: string; displayName: string; password: string; confirm: string }) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), values.email);
  await user.type(screen.getByLabelText("Display name"), values.displayName);
  await user.type(screen.getByLabelText("Password"), values.password);
  await user.type(screen.getByLabelText("Confirm password"), values.confirm);
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

beforeEach(() => {
  vi.mocked(useSetup).mockReturnValue(mutationStub<SetupMutation>());
});

test("renders the title and labelled fields", async () => {
  await renderPage(SetupPage);
  expect(screen.getByRole("heading", { level: 1, name: "Set up your account" })).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
  expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  expect(screen.getByLabelText("Confirm password")).toHaveAttribute("type", "password");
});

test("shows the length message when the password is short", async () => {
  const mutate = vi.fn();
  vi.mocked(useSetup).mockReturnValue(mutationStub<SetupMutation>({ mutate }));
  await renderPage(SetupPage);
  await fillForm({ email: "a@b.co", displayName: "Alex", password: "short", confirm: "short" });
  expect(screen.getByText("Use at least 10 characters.")).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Use at least 10 characters.");
  expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  expect(mutate).not.toHaveBeenCalled();
});

test("shows the mismatch message when passwords differ", async () => {
  const mutate = vi.fn();
  vi.mocked(useSetup).mockReturnValue(mutationStub<SetupMutation>({ mutate }));
  await renderPage(SetupPage);
  await fillForm({
    email: "a@b.co",
    displayName: "Alex",
    password: "correct horse battery",
    confirm: "correct horse battery staple",
  });
  expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
  expect(screen.getByLabelText("Confirm password")).toHaveAccessibleDescription("Passwords don't match.");
  expect(mutate).not.toHaveBeenCalled();
});

test("submits the parsed input with a lowercased email", async () => {
  const mutate = vi.fn();
  vi.mocked(useSetup).mockReturnValue(mutationStub<SetupMutation>({ mutate }));
  await renderPage(SetupPage);
  await fillForm({
    email: " Alex@Example.COM ",
    displayName: " Alex ",
    password: "correct horse battery",
    confirm: "correct horse battery",
  });
  expect(mutate).toHaveBeenCalledTimes(1);
  expect(mutate.mock.calls[0]?.[0]).toEqual({
    email: "alex@example.com",
    displayName: "Alex",
    password: "correct horse battery",
  });
  expect(screen.queryByText("Use at least 10 characters.")).not.toBeInTheDocument();
});

test("renders the already set up message with a login link on 409", async () => {
  vi.mocked(useSetup).mockReturnValue(
    mutationStub<SetupMutation>({ isError: true, error: new ApiError(409, { error: "already_set_up" }) }),
  );
  await renderPage(SetupPage);
  expect(screen.getByRole("alert")).toHaveTextContent("An account already exists. Log in instead.");
  expect(screen.getByRole("link", { name: "Log in instead." })).toHaveAttribute("href", "/login");
});
