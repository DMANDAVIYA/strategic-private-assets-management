import { LoginInput } from "@financeper/shared";
import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useLogin } from "../api/auth";
import { NetworkError, isApiError } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { fieldErrorsFrom, type FieldMessages } from "../lib/fieldErrors";
import { formatClockTime } from "../lib/format";

const MESSAGES: FieldMessages = {
  email: { default: "Enter a valid email address." },
  password: { default: "Enter your password." },
};

function lockedUntil(body: unknown): number | null {
  if (typeof body === "object" && body !== null && "until" in body && typeof body.until === "number") {
    return body.until;
  }
  return null;
}

function serverMessage(error: Error | null): string | null {
  if (error === null) {
    return null;
  }
  if (isApiError(error, 401)) {
    return "Email or password is wrong.";
  }
  if (isApiError(error, 423)) {
    const until = lockedUntil(error.body);
    return until === null ? "Too many attempts. Try again later." : `Too many attempts. Try again at ${formatClockTime(until)}.`;
  }
  if (error instanceof NetworkError) {
    return "Can't reach your PC.";
  }
  return "Something went wrong. Try again.";
}

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = LoginInput.safeParse({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      trustDevice: form.get("trustDevice") === "on",
    });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error.issues, MESSAGES));
      return;
    }
    setErrors({});
    login.mutate(parsed.data, { onSuccess: () => void navigate({ to: "/" }) });
  }

  const message = serverMessage(login.error);

  return (
    <AuthLayout title="Log in">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4 rounded-panel bg-panel p-5">
        <Field id="email" name="email" label="Email" type="email" autoComplete="email" error={errors.email} />
        <Field
          id="password"
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password}
        />
        <label className="flex min-h-11 items-center gap-2 text-[0.84rem] text-muted sm:min-h-0">
          <input type="checkbox" name="trustDevice" className="size-4" />
          Trust this device for 30 days
        </label>
        {message === null ? null : (
          <p role="alert" className="text-[0.84rem] text-negative">
            {message}
          </p>
        )}
        <Button type="submit" className="mt-1 w-full py-2.5" disabled={login.isPending}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
