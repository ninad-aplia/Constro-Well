// Add/edit product dialog — port of buildgrid-seller-dashboard.html's
// `dProduct()` (line 259) and its `fProd` validation (line 441).
//
// The form is split into its own component, keyed by the target product's id
// (or "new"): remounting on a fresh key re-initializes state straight from
// props via useState's initializer, rather than resetting it with a
// setState-in-effect (which `react-hooks/set-state-in-effect` flags, same
// pattern already fixed once in `Stepper.tsx`).
"use client";

import { useState } from "react";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import SellerIcon from "./SellerIcon";
import { useSellerStore, type ProductInput } from "./SellerStoreProvider";
import { COMMISSION_RATE } from "@/lib/seller/rules";
import type { SellerProduct } from "@/lib/seller/types";

const CATEGORIES = ["Cement", "Mortar", "Steel", "Sand", "Bricks", "White"];

const EMPTY: ProductInput = {
  name: "",
  category: CATEGORIES[0],
  unit: "bag",
  mrp: 0,
  price: 0,
  stock: 0,
  minOrderQty: 1,
  weightKg: 0,
  reorderLevel: 20,
  bulk: false,
};

function toFormInput(product: SellerProduct | null): ProductInput {
  if (!product) return EMPTY;
  const { name, category, unit, mrp, price, stock, minOrderQty, weightKg, reorderLevel, bulk } = product;
  return { name, category, unit, mrp, price, stock, minOrderQty, weightKg, reorderLevel, bulk };
}

function ProductForm({ product, onClose }: { product: SellerProduct | null; onClose: () => void }) {
  const { addProduct, editProduct } = useSellerStore();
  const [form, setForm] = useState<ProductInput>(() => toFormInput(product));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    const next: Record<string, string> = {};
    if (form.name.length < 4) next.name = "Enter the full product name";
    if (!(form.mrp > 0)) next.mrp = "Enter the MRP";
    if (!(form.price > 0) || form.price > form.mrp) next.price = "Price must be above 0 and not more than the MRP";
    if (form.stock < 0) next.stock = "Enter your stock";
    if (!(form.minOrderQty >= 1)) next.minOrderQty = "Minimum is 1";
    if (!(form.weightKg > 0)) next.weightKg = "Enter the weight per unit";
    if (form.unit.length < 2) next.unit = "Enter a unit";
    setErrors(next);
    if (Object.keys(next).length) return;
    if (product) editProduct(product.id, form);
    else addProduct(form);
    onClose();
  };

  return (
    <form
      className="relative grid gap-3 p-[22px]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 grid h-[34px] w-[34px] place-items-center rounded-lg bg-tint"
      >
        <SellerIcon name="x" size={16} />
      </button>
      <h2 className="font-display text-lg font-bold">{product ? "Edit product" : "Add a product"}</h2>

      <label className="grid gap-1 text-sm font-semibold">
        Product name
        <input
          className="h-10 rounded-lg border border-line bg-panel px-2.5"
          value={form.name}
          placeholder="TMT Fe500D bar, 12 mm, 12 m"
          onChange={(e) => set("name", e.target.value)}
        />
        {errors.name && <span className="text-[13px] font-medium text-bad">{errors.name}</span>}
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="grid gap-1 text-sm font-semibold">
          Category
          <select className="h-10 rounded-lg border border-line bg-panel px-2.5" value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Unit
          <input className="h-10 rounded-lg border border-line bg-panel px-2.5" value={form.unit} placeholder="bag, bar, tonne" onChange={(e) => set("unit", e.target.value)} />
          {errors.unit && <span className="text-[13px] font-medium text-bad">{errors.unit}</span>}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="grid gap-1 text-sm font-semibold">
          MRP (₹)
          <input type="number" min={1} className="h-10 rounded-lg border border-line bg-panel px-2.5" value={form.mrp || ""} onChange={(e) => set("mrp", Number(e.target.value))} />
          {errors.mrp && <span className="text-[13px] font-medium text-bad">{errors.mrp}</span>}
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Your price (₹)
          <input type="number" min={1} className="h-10 rounded-lg border border-line bg-panel px-2.5" value={form.price || ""} onChange={(e) => set("price", Number(e.target.value))} />
          {errors.price && <span className="text-[13px] font-medium text-bad">{errors.price}</span>}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="grid gap-1 text-sm font-semibold">
          Stock
          <input type="number" min={0} className="h-10 rounded-lg border border-line bg-panel px-2.5" value={form.stock} onChange={(e) => set("stock", Number(e.target.value))} />
          {errors.stock && <span className="text-[13px] font-medium text-bad">{errors.stock}</span>}
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Minimum order quantity
          <input type="number" min={1} className="h-10 rounded-lg border border-line bg-panel px-2.5" value={form.minOrderQty} onChange={(e) => set("minOrderQty", Number(e.target.value))} />
          {errors.minOrderQty && <span className="text-[13px] font-medium text-bad">{errors.minOrderQty}</span>}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="grid gap-1 text-sm font-semibold">
          Weight per unit (kg)
          <input type="number" min={0.1} step={0.1} className="h-10 rounded-lg border border-line bg-panel px-2.5" value={form.weightKg || ""} onChange={(e) => set("weightKg", Number(e.target.value))} />
          {errors.weightKg && <span className="text-[13px] font-medium text-bad">{errors.weightKg}</span>}
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Restock alert at
          <input type="number" min={0} className="h-10 rounded-lg border border-line bg-panel px-2.5" value={form.reorderLevel} onChange={(e) => set("reorderLevel", Number(e.target.value))} />
        </label>
      </div>

      <label className="flex items-start gap-2.5 rounded-lg border border-line p-2.5 has-[:checked]:border-ink has-[:checked]:bg-tint">
        <input type="checkbox" checked={form.bulk} onChange={(e) => set("bulk", e.target.checked)} className="mt-1 accent-nav" />
        <span>Bulk goods (needs a weighbridge slip at dispatch)</span>
      </label>

      <p className="text-sm text-muted">
        Buyers automatically get 3% off at 10+ units, 6% at 50+ and 10% at 200+. Platform commission is {COMMISSION_RATE * 100}% of the
        item value.
      </p>

      <Button type="submit" variant="yellow" wide>
        {product ? "Save changes" : "Add product"}
      </Button>
    </form>
  );
}

export default function ProductDialog({
  product,
  open,
  onClose,
}: {
  /** Editing an existing product, or `null` to add a new one. */
  product: SellerProduct | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={product ? "Edit product" : "Add a product"} wide>
      {open && <ProductForm key={product?.id ?? "new"} product={product} onClose={onClose} />}
    </Dialog>
  );
}
