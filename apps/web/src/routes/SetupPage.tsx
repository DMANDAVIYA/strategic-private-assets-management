import { SetupInput } from "@financeper/shared";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { useSetup } from "../api/auth";
import { NetworkError, isApiError } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { fieldErrorsFrom, type FieldMessages } from "../lib/fieldErrors";

const MESSAGES: FieldMessages = {
  email: { default: "Enter a valid email address." },
  displayName: { default: "Enter a display name.", too_big: "Use at most 60 characters." },
  password: { default: "Enter a password.", too_small: "Use at least 10 characters.", too_big: "Use at most 200 characters." },
};

function serverMessage(error: Error | null): ReactNode {
  if (error === null) {
    return null;
  }
  if (isApiError(error, 409)) {
    return (
      <>
        An account already exists.{" "}
        <Link to="/login" className="-my-3 inline-block py-3 text-text underline underline-offset-2 sm:my-0 sm:py-0">
          Log in instead.
        </Link>
      </>
    );
  }
  if (error instanceof NetworkError) {
    return "Can't reach your PC.";
  }
  return "Something went wrong. Try again.";
}

export function SetupPage() {
  const setup = useSetup();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const raw = {
      email: String(form.get("email") ?? ""),
      displayName: String(form.get("displayName") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const parsed = SetupInput.safeParse(raw);
    const next = parsed.success ? {} : fieldErrorsFrom(parsed.error.issues, MESSAGES);
    if (confirmPassword !== raw.password) {
      next.confirmPassword = "Passwords don't match.";
    }
    setErrors(next);
    if (!parsed.success || Object.keys(next).length > 0) {
      return;
    }
    setup.mutate(parsed.data, { onSuccess: () => void navigate({ to: "/" }) });
  }

  const message = serverMessage(setup.error);

  return (
    <AuthLayout title="Set up your account" lead="One account for this PC. You'll use the same login from your phone.">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4 rounded-panel bg-panel p-5">
        <Field id="email" name="email" label="Email" type="email" autoComplete="email" error={errors.email} />
        <Field id="displayName" name="displayName" label="Display name" autoComplete="nickname" error={errors.displayName} />
        <Field
          id="password"
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          error={errors.password}
        />
        <Field
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword}
        />
        {message === null ? null : (
          <p role="alert" className="text-[0.84rem] text-negative">
            {message}
          </p>
        )}
        <Button type="submit" className="mt-1 w-full py-2.5" disabled={setup.isPending}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
