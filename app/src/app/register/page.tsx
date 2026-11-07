import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import RegisterForm from "@/components/auth/RegisterForm";
import { homeForRole, safeNext } from "@/components/auth/redirect";
import { getCurrentUser } from "@/server/auth/current";

export const instant = false;

export const metadata = { title: "Create an account" };

export default async function RegisterPage({
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
      title="Create your account"
      subtitle="Customer accounts can place COD orders and track deliveries."
    >
      <RegisterForm next={next} />
    </AuthShell>
  );
}
