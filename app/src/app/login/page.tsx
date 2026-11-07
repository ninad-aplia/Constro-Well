import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";
import { homeForRole, safeNext } from "@/components/auth/redirect";
import { getCurrentUser } from "@/server/auth/current";

export const instant = false;

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNext(Array.isArray(params.next) ? params.next[0] : params.next);
  const user = await getCurrentUser();
  if (user) redirect(next ?? homeForRole(user.role));

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to place orders, track deliveries and manage your seller listings."
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
