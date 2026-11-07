"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: "customer" | "seller" | "driver" | "admin";
}

type SessionStatus = "loading" | "authenticated" | "guest";

interface SessionValue {
  user: SessionUser | null;
  status: SessionStatus;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

async function fetchSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
  if (!response.ok) return null;
  const body = (await response.json()) as { user?: SessionUser };
  return body.user ?? null;
}

export function useSession(): SessionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");

  const refresh = useCallback(async () => {
    const current = await fetchSession();
    setUser(current);
    setStatus(current ? "authenticated" : "guest");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSession()
      .then((current) => {
        if (cancelled) return;
        setUser(current);
        setStatus(current ? "authenticated" : "guest");
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus("guest");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      setUser(null);
      setStatus("guest");
    }
  }, []);

  return <Ctx.Provider value={{ user, status, refresh, logout }}>{children}</Ctx.Provider>;
}
