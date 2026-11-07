"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { ApiClientError } from "@/lib/api/client";
import {
  addCartItem,
  applyCartCoupon,
  fetchCart,
  removeCartCoupon,
  removeCartItem,
  updateCartItem,
} from "@/lib/api/cartApi";
import type { CartDto } from "@/lib/api/cartDto";

export type RemoteCartStatus = "loading" | "ready" | "error" | "guest" | "forbidden";

interface RemoteCartValue {
  cart: CartDto | null;
  status: RemoteCartStatus;
  error: string;
  count: number;
  refresh: () => Promise<void>;
  add: (sellerOfferId: string, qty: number) => Promise<void>;
  setQty: (itemId: string, qty: number) => Promise<void>;
  setSaved: (itemId: string, savedForLater: boolean) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<{ ok: boolean; msg: string }>;
  clearCoupon: () => Promise<void>;
}

const Ctx = createContext<RemoteCartValue | null>(null);

export function useRemoteCart(): RemoteCartValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRemoteCart must be used within RemoteCartProvider");
  return ctx;
}

function messageOf(error: unknown): string {
  return error instanceof ApiClientError ? error.message : "Could not reach the cart service.";
}

export default function RemoteCartProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const [data, setData] = useState<CartDto | null>(null);
  const [dataStatus, setDataStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session.status !== "authenticated" || session.user?.role !== "customer") return;
    let cancelled = false;
    fetchCart()
      .then((current) => {
        if (cancelled) return;
        setData(current);
        setLoadedFor(session.user?.id ?? null);
        setDataStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(messageOf(err));
        setLoadedFor(session.user?.id ?? null);
        setDataStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [session.status, session.user?.id, session.user?.role]);

  const apply = useCallback((next: CartDto) => {
    setData(next);
    setDataStatus("ready");
    setError("");
  }, []);

  const status: RemoteCartStatus =
    session.status === "loading"
      ? "loading"
      : session.status === "guest"
        ? "guest"
        : session.user?.role !== "customer"
          ? "forbidden"
          : loadedFor === session.user.id
            ? dataStatus
            : "loading";

  const cart = status === "ready" ? data : null;

  const refresh = useCallback(async () => {
    try {
      const next = await fetchCart();
      apply(next);
      setLoadedFor(session.user?.id ?? null);
    } catch (err) {
      setError(messageOf(err));
      setLoadedFor(session.user?.id ?? null);
      setDataStatus("error");
      throw err;
    }
  }, [apply, session.user]);

  const add = useCallback(
    async (sellerOfferId: string, qty: number) => {
      apply(await addCartItem(sellerOfferId, qty));
    },
    [apply],
  );

  const setQty = useCallback(
    async (itemId: string, qty: number) => {
      apply(await updateCartItem(itemId, { qty }));
    },
    [apply],
  );

  const setSaved = useCallback(
    async (itemId: string, savedForLater: boolean) => {
      apply(await updateCartItem(itemId, { savedForLater }));
    },
    [apply],
  );

  const remove = useCallback(
    async (itemId: string) => {
      apply(await removeCartItem(itemId));
    },
    [apply],
  );

  const applyCoupon = useCallback(
    async (code: string): Promise<{ ok: boolean; msg: string }> => {
      try {
        const next = await applyCartCoupon(code);
        apply(next);
        return { ok: true, msg: next.couponMessage ?? `${code.trim().toUpperCase()} applied` };
      } catch (err) {
        return { ok: false, msg: messageOf(err) };
      }
    },
    [apply],
  );

  const clearCoupon = useCallback(async () => {
    apply(await removeCartCoupon());
  }, [apply]);

  const value = useMemo<RemoteCartValue>(
    () => ({
      cart,
      status,
      error,
      count: cart?.totals.itemCount ?? 0,
      refresh,
      add,
      setQty,
      setSaved,
      remove,
      applyCoupon,
      clearCoupon,
    }),
    [cart, status, error, refresh, add, setQty, setSaved, remove, applyCoupon, clearCoupon],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
