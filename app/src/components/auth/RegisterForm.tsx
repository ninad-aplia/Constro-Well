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

export default function RegisterForm({ next }: { next?: string | null }) {
  const router = useRouter();
  const { refresh } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (name.trim().length < 2) nextErrors.name = "Enter your name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address";
    }
    if (password.length < 8) nextErrors.password = "Use at least 8 characters";
    if (password.length > 72) nextErrors.password = "Use at most 72 characters";
    if (confirm !== password) nextErrors.confirm = "Passwords do not match";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setServerError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const body = (await response.json().catch(() => null)) as AuthBody | null;
      if (!response.ok || !body?.user) {
        const error = body?.error;
        if (error?.field) setErrors({ [error.field]: error.message ?? "Check this field" });
        else setServerError(error?.message ?? "Could not create your account. Try again.");
        return;
      }

      await refresh();
      router.replace(safeNext(next) ?? homeForRole(body.user.role));
      router.refresh();
    } catch {
      setServerError("Could not reach the registration service. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="grid gap-3.5" onSubmit={submit} noValidate>
      <label htmlFor="register_name" className="grid gap-1 text-sm font-semibold">
        Full name
        <input
          id="register_name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-11 rounded-lg border border-line bg-panel px-3 text-ink"
        />
        {errors.name && <span className="text-[13px] font-medium text-bad">{errors.name}</span>}
      </label>

      <label htmlFor="register_email" className="grid gap-1 text-sm font-semibold">
        Email
        <input
          id="register_email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11 rounded-lg border border-line bg-panel px-3 text-ink"
        />
        {errors.email && <span className="text-[13px] font-medium text-bad">{errors.email}</span>}
      </label>

      <PasswordField
        id="register_password"
        label="Password"
        value={password}
        onChange={setPassword}
        error={errors.password}
        autoComplete="new-password"
      />

      <PasswordField
        id="register_confirm"
        label="Confirm password"
        value={confirm}
        onChange={setConfirm}
        error={errors.confirm}
        autoComplete="new-password"
      />

      {serverError && (
        <p role="alert" className="rounded-lg border border-bad bg-panel px-3 py-2 text-[13px] font-medium text-bad">
          {serverError}
        </p>
      )}

      <Button type="submit" variant="yellow" wide disabled={submitting}>
        {submitting ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-link hover:underline">
          Sign in
        </Link>
      </p>
      <p className="text-xs text-muted">
        Public registration creates a customer account only. Seller, driver and
        admin accounts are provisioned separately.
      </p>
    </form>
  );
}
