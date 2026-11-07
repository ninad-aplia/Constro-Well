"use client";

import Button from "@/components/ui/Button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto grid max-w-[900px] justify-items-center gap-3 px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
      <p className="max-w-[560px] text-muted">
        We could not load this page from the marketplace database. Your cart is
        stored in this browser and has not been changed.
      </p>
      <Button variant="yellow" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
