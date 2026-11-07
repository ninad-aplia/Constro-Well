"use client";

import Button from "@/components/ui/Button";

export default function DeliveryError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto grid max-w-[760px] justify-items-center px-4 py-16">
      <section role="alert" className="grid w-full justify-items-center gap-2 rounded-2xl border border-line bg-panel p-8 text-center">
        <h1 className="font-display text-xl font-bold">Deliveries couldn&rsquo;t load</h1>
        <p className="text-muted">Check your connection and try again.</p>
        <Button variant="line" onClick={reset}>Try again</Button>
      </section>
    </div>
  );
}
