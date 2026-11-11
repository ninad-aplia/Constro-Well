"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { useSession, type SessionUser } from "./SessionProvider";
import PasswordField from "./PasswordField";
import { homeForRole, safeNext } from "./redirect";

interface AuthBody {
  user?: SessionUser;
  error?: { code?: string; message?: string; field?: string };
}

export default function LoginForm({ next }: { next?: string | null }) {
  const router = useRouter();
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address";
    }
    if (!password) nextErrors.password = "Enter your password";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setServerError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = (await response.json().catch(() => null)) as AuthBody | null;
      if (!response.ok || !body?.user) {
        const error = body?.error;
        if (error?.field) setErrors({ [error.field]: error.message ?? "Check this field" });
        else setServerError(error?.message ?? "Could not sign in. Check your details and try again.");
        return;
      }

      await refresh();
      router.replace(safeNext(next) ?? homeForRole(body.user.role));
      router.refresh();
    } catch {
      setServerError("Could not reach the sign-in service. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // method="post" is only the pre-hydration fallback: without it a click before
  // React attaches would submit the password in the query string.
  return (
    <form className="grid gap-3.5" method="post" onSubmit={submit} noValidate>
      <label htmlFor="login_email" className="grid gap-1 text-sm font-semibold">
        Email
        <input
          id="login_email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11 rounded-lg border border-line bg-panel px-3 text-ink"
        />
        {errors.email && <span className="text-[13px] font-medium text-bad">{errors.email}</span>}
      </label>

      <PasswordField
        id="login_password"
        label="Password"
        value={password}
        onChange={setPassword}
        error={errors.password}
        autoComplete="current-password"
      />

      {serverError && (
        <p role="alert" className="rounded-lg border border-bad bg-panel px-3 py-2 text-[13px] font-medium text-bad">
          {serverError}
        </p>
      )}

      <Button type="submit" variant="yellow" wide disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-sm text-muted">
        New to Constro Well?{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-semibold text-link hover:underline">
          Create an account
        </Link>
      </p>
      <p className="text-xs text-muted">
        Sellers use this same form. Seller accounts are provisioned by Constro Well.
      </p>
    </form>
  );
}
