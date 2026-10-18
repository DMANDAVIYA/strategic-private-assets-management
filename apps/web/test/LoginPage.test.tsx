import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLogin } from "../src/api/auth";
import { ApiError } from "../src/api/client";
import { LoginPage } from "../src/routes/LoginPage";
import { mutationStub, renderPage } from "./helpers";

vi.mock("../src/api/auth", () => ({ useLogin: vi.fn() }));

type LoginMutation = ReturnType<typeof useLogin>;

beforeEach(() => {
  vi.mocked(useLogin).mockReturnValue(mutationStub<LoginMutation>());
});

test("renders the title, labelled fields and the trust checkbox", async () => {
  await renderPage(LoginPage);
  expect(screen.getByRole("heading", { level: 1, name: "Log in" })).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
  expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  expect(screen.getByLabelText("Trust this device for 30 days")).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
});

test("submits the parsed input with the trust flag", async () => {
  const mutate = vi.fn();
  vi.mocked(useLogin).mockReturnValue(mutationStub<LoginMutation>({ mutate }));
  await renderPage(LoginPage);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), " Alex@Example.COM ");
  await user.type(screen.getByLabelText("Password"), "correct horse battery");
  await user.click(screen.getByLabelText("Trust this device for 30 days"));
  await user.click(screen.getByRole("button", { name: "Log in" }));
  expect(mutate).toHaveBeenCalledTimes(1);
  expect(mutate.mock.calls[0]?.[0]).toEqual({
    email: "alex@example.com",
    password: "correct horse battery",
    trustDevice: true,
  });
});

test("renders the wrong credentials message on 401", async () => {
  vi.mocked(useLogin).mockReturnValue(
    mutationStub<LoginMutation>({ isError: true, error: new ApiError(401, { error: "invalid_credentials" }) }),
  );
  await renderPage(LoginPage);
  expect(screen.getByRole("alert")).toHaveTextContent("Email or password is wrong.");
});

test("renders the lockout message with the local unlock time on 423", async () => {
  const until = Date.UTC(2026, 9, 17, 19, 5);
  vi.mocked(useLogin).mockReturnValue(
    mutationStub<LoginMutation>({ isError: true, error: new ApiError(423, { error: "locked", until }) }),
  );
  await renderPage(LoginPage);
  expect(screen.getByRole("alert")).toHaveTextContent("Too many attempts. Try again at 3:05 PM.");
});
