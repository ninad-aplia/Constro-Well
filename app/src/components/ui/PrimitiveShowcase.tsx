// Interactive verification of the Phase-1 UI primitives (TASK 1.3).
// QA helper that lives on the placeholder home only until the real
// storefront replaces it; no business logic anywhere.
"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import Pill from "@/components/ui/Pill";
import Stars from "@/components/ui/Stars";
import Stepper from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/Toast";

export default function PrimitiveShowcase() {
  const toast = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qty, setQty] = useState(10);
  const [stepperFeedback, setStepperFeedback] = useState("");

  return (
    <section aria-label="Phase 1 primitive verification" className="mt-6">
      <Card className="p-5">
        <h2 className="mb-3 font-display text-lg font-bold">Component library (TASK 1.3 QA)</h2>

        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary yellow</Button>
          <Button variant="orange">Orange</Button>
          <Button variant="line">Line</Button>
          <Button variant="line" size="sm">Small</Button>
          <Button pill>Shop pill</Button>
          <Button variant="line" disabled>Disabled</Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Pill tone="ok">Active</Pill>
          <Pill tone="warn">Low stock</Pill>
          <Pill tone="bad">Disputed</Pill>
          <Pill tone="info">In review</Pill>
          <Pill>Neutral</Pill>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-5">
          <span className="flex items-center gap-2"><Stars value={4.6} /> 4.6</span>
          <span className="flex items-center gap-2"><Stars value={3} /> 3.0</span>
          <span className="flex items-center gap-2"><Stars value={0} /> 0.0</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-5">
          <span className="flex items-center gap-3">
            <Stepper value={qty} min={1} max={420} onChange={setQty} label="Stepper demo quantity" />
            <span className="text-sm text-muted">qty = {qty} (min 1, max 420)</span>
          </span>
          <Button variant="line" size="sm" onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Button
            variant="line"
            size="sm"
            onClick={() => toast.show("Added to cart", { label: "Go to cart", onClick: () => setStepperFeedback('toast action chained') })}
          >
            Show toast
          </Button>
          {stepperFeedback && <span className="text-sm text-ok">toast action fired ✓</span>}
        </div>

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Example dialog">
          <div className="grid gap-3 p-6">
            <h3 className="font-display text-lg font-bold">Example dialog</h3>
            <p className="text-sm text-ink2">
              Native <code>&lt;dialog&gt;</code> with prototype styling: Escape and backdrop
              behaviour from the platform, backdrop color from the prototype.
            </p>
            <Button wide onClick={() => setDialogOpen(false)}>Close</Button>
          </div>
        </Dialog>
      </Card>
    </section>
  );
}
