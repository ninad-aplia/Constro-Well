"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "./SessionProvider";

export default function LogoutButton({
  className,
  label = "Sign out",
}: {
  className?: string;
  label?: string;
}) {
  const { logout } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await logout();
          router.replace("/");
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className={className}
    >
      {busy ? "Signing out…" : label}
    </button>
  );
}
