"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api/client";
import type { SellerSummaryDto } from "@/lib/api/sellerOrderDto";

interface SellerLiveValue {
  summary: SellerSummaryDto;
  refresh: () => Promise<void>;
}

const Ctx = createContext<SellerLiveValue | null>(null);

export function useSellerLive(): SellerLiveValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSellerLive must be used within SellerLiveProvider");
  return ctx;
}

export default function SellerLiveProvider({
  initialSummary,
  children,
}: {
  initialSummary: SellerSummaryDto;
  children: ReactNode;
}) {
  const [summary, setSummary] = useState(initialSummary);

  const refresh = useCallback(async () => {
    const response = await apiFetch<{ summary: SellerSummaryDto }>("/api/seller/summary");
    setSummary(response.summary);
  }, []);

  return <Ctx.Provider value={{ summary, refresh }}>{children}</Ctx.Provider>;
}
