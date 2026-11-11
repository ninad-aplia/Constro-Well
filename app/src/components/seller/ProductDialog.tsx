// Add/edit listing dialog — same Dialog/field styling as the prototype port,
// now backed by the authenticated seller inventory API. Canonical product
// fields (name/category/unit/MRP/weight) are read-only: sellers own their
// SellerOffer price/stock/terms, not the catalogue product.
"use client";

import { useEffect, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import SellerIcon from "./SellerIcon";
import { ApiClientError } from "@/lib/api/client";
import { fetchProducts } from "@/lib/api/catalogApi";
import { createSellerProduct, updateSellerProduct } from "@/lib/api/sellerApi";
import type { ProductSummaryDto, SellerProductDto } from "@/lib/api/dto";
import { COMMISSION_RATE } from "@/lib/seller/rules";

interface FormState {
  productId: string;
  price: number;
  stock: number;
  minOrderQty: number;
  reorderLevel: number;
  leadTimeDays: number;
  bulkTiers: [number, number][];
}

const EMPTY: FormState = {
  productId: "",
  price: 0,
  stock: 0,
  minOrderQty: 1,
  reorderLevel: 0,
  leadTimeDays: 1,
  bulkTiers: [],
};

function toForm(product: SellerProductDto | null): FormState {
  if (!product) return EMPTY;
  return {
    productId: product.productId,
    price: Number(product.price),
    stock: product.stock,
    minOrderQty: product.minOrderQty,
    reorderLevel: product.reorderLevel,
    leadTimeDays: product.leadTimeDays,
    bulkTiers: product.bulkTiers ?? [],
  };
}

function messageOf(error: unknown): string {
  return error instanceof ApiClientError ? error.message : "Could not save this listing. Try again.";
}

function ProductForm({
  product,
  onClose,
  onSaved,
}: {
  product: SellerProductDto | null;
  onClose: () => void;
  onSaved: (product: SellerProductDto) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(product));
  const [catalog, setCatalog] = useState<ProductSummaryDto[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) return;
    let cancelled = false;
    fetchProducts({ pageSize: 50 })
      .then((result) => {
        if (!cancelled) setCatalog(result.products);
      })
      .catch((error: unknown) => {
        if (!cancelled) setCatalogError(messageOf(error));
      });
    return () => {
      cancelled = true;
    };
  }, [product]);

  const selected = product
    ? product
    : catalog.find((item) => item.id === form.productId) ?? null;
  const isNew = !product;
  const mrp = selected ? Number(selected.mrp) : 0;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    const next: Record<string, string> = {};
    if (isNew && !form.productId) next.productId = "Choose a product";
    if (!(form.price > 0)) next.price = "Enter a price above 0";
    if (mrp > 0 && form.price > mrp) next.price = "Price cannot be more than the MRP";
    if (!Number.isInteger(form.stock) || form.stock < 0) next.stock = "Enter valid stock";
    if (!Number.isInteger(form.minOrderQty) || form.minOrderQty < 1) {
      next.minOrderQty = "Minimum is 1";
    }
    if (!Number.isInteger(form.reorderLevel) || form.reorderLevel < 0) {
      next.reorderLevel = "Enter a valid restock level";
    }
    if (!Number.isInteger(form.leadTimeDays) || form.leadTimeDays < 0) {
      next.leadTimeDays = "Enter a valid lead time";
    }
    const tiers = [...form.bulkTiers].sort((a, b) => a[0] - b[0]);
    if (tiers.length > 5) {
      next.bulkTiers = "Use at most 5 tiers";
    } else if (tiers.some(([qty]) => !Number.isInteger(qty) || qty < 2 || qty > 100_000)) {
      next.bulkTiers = "Tier quantity must be a whole number of 2 or more";
    } else if (tiers.some(([, pct]) => !Number.isInteger(pct) || pct < 1 || pct > 90)) {
      next.bulkTiers = "Tier discount must be a whole number between 1% and 90%";
    } else if (new Set(tiers.map(([qty]) => qty)).size !== tiers.length) {
      next.bulkTiers = "Tier quantities must be distinct";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setApiError("");
    setSaving(true);
    try {
      const input = {
        price: form.price,
        stock: form.stock,
        minOrderQty: form.minOrderQty,
        reorderLevel: form.reorderLevel,
        leadTimeDays: form.leadTimeDays,
        bulkTiers: tiers,
      };
      const saved = product
        ? await updateSellerProduct(product.offerId, input)
        : await createSellerProduct({ productId: form.productId, ...input });
      onSaved(saved);
      onClose();
    } catch (error) {
      setApiError(messageOf(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="relative grid gap-3 p-[22px]"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
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
      <h2 className="font-display text-lg font-bold">{product ? "Edit listing" : "Add a listing"}</h2>

      {isNew ? (
        <label className="grid gap-1 text-sm font-semibold">
          Catalogue product
          <select
            className="h-10 rounded-lg border border-line bg-panel px-2.5"
            value={form.productId}
            onChange={(event) => {
              const nextId = event.target.value;
              const nextProduct = catalog.find((item) => item.id === nextId);
              setForm((current) => ({
                ...current,
                productId: nextId,
                price: nextProduct ? Number(nextProduct.price) : current.price,
              }));
            }}
          >
            <option value="">Choose a product</option>
            {catalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — ₹{item.price} / {item.unit}
              </option>
            ))}
          </select>
          {catalogError && <span className="text-[13px] font-medium text-bad">{catalogError}</span>}
          {errors.productId && <span className="text-[13px] font-medium text-bad">{errors.productId}</span>}
        </label>
      ) : null}

      {selected && (
        <div className="rounded-lg border border-line bg-tint px-3 py-2 text-sm">
          <b>{selected.name}</b>
          <span className="mt-0.5 block text-[13px] text-muted">
            {selected.category} · {selected.unit} · MRP ₹{selected.mrp}
            {product ? ` · ${product.unitWeightKg} kg per unit${product.bulkFlag ? " · bulk goods" : ""}` : ""}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <label className="grid gap-1 text-sm font-semibold">
          Your price (₹)
          <input
            type="number"
            min={1}
            className="h-10 rounded-lg border border-line bg-panel px-2.5"
            value={form.price || ""}
            onChange={(event) => set("price", Number(event.target.value))}
          />
          {errors.price && <span className="text-[13px] font-medium text-bad">{errors.price}</span>}
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Stock
          <input
            type="number"
            min={0}
            className="h-10 rounded-lg border border-line bg-panel px-2.5"
            value={form.stock}
            onChange={(event) => set("stock", Number(event.target.value))}
          />
          {errors.stock && <span className="text-[13px] font-medium text-bad">{errors.stock}</span>}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="grid gap-1 text-sm font-semibold">
          Minimum order quantity
          <input
            type="number"
            min={1}
            className="h-10 rounded-lg border border-line bg-panel px-2.5"
            value={form.minOrderQty}
            onChange={(event) => set("minOrderQty", Number(event.target.value))}
          />
          {errors.minOrderQty && <span className="text-[13px] font-medium text-bad">{errors.minOrderQty}</span>}
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Lead time (days)
          <input
            type="number"
            min={0}
            max={60}
            className="h-10 rounded-lg border border-line bg-panel px-2.5"
            value={form.leadTimeDays}
            onChange={(event) => set("leadTimeDays", Number(event.target.value))}
          />
          {errors.leadTimeDays && <span className="text-[13px] font-medium text-bad">{errors.leadTimeDays}</span>}
        </label>
      </div>

      <label className="grid gap-1 text-sm font-semibold">
        Restock alert at
        <input
          type="number"
          min={0}
          className="h-10 rounded-lg border border-line bg-panel px-2.5"
          value={form.reorderLevel}
          onChange={(event) => set("reorderLevel", Number(event.target.value))}
        />
        {errors.reorderLevel && <span className="text-[13px] font-medium text-bad">{errors.reorderLevel}</span>}
      </label>

      <p className="text-sm text-muted">
        Buyers automatically get 3% off at 10+ units, 6% at 50+ and 10% at 200+. Platform commission is{" "}
        {COMMISSION_RATE * 100}% of the item value.
      </p>

      <section className="rounded-lg border border-line p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <b className="text-sm">Bulk pricing for this listing</b>
          <Button
            type="button"
            size="sm"
            variant="line"
            disabled={form.bulkTiers.length >= 5}
            onClick={() =>
              set("bulkTiers", [
                ...form.bulkTiers,
                [Math.max(10, form.minOrderQty), 3] as [number, number],
              ])
            }
          >
            Add tier
          </Button>
        </div>
        <p className="mt-1 text-[13px] text-muted">
          Optional. Leave empty to use the marketplace defaults above; otherwise these tiers replace them for this
          listing only.
        </p>
        {form.bulkTiers.length > 0 && (
          <div className="mt-2 grid gap-2">
            {form.bulkTiers.map(([qty, pct], index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <label className="grid gap-1 text-[13px] font-semibold">
                  From quantity
                  <input
                    type="number"
                    min={2}
                    className="h-9 rounded-lg border border-line bg-panel px-2"
                    value={qty}
                    onChange={(event) =>
                      set(
                        "bulkTiers",
                        form.bulkTiers.map((tier, i) =>
                          i === index ? [Number(event.target.value), tier[1]] : tier,
                        ),
                      )
                    }
                  />
                </label>
                <label className="grid gap-1 text-[13px] font-semibold">
                  % off
                  <input
                    type="number"
                    min={1}
                    max={90}
                    className="h-9 rounded-lg border border-line bg-panel px-2"
                    value={pct}
                    onChange={(event) =>
                      set(
                        "bulkTiers",
                        form.bulkTiers.map((tier, i) =>
                          i === index ? [tier[0], Number(event.target.value)] : tier,
                        ),
                      )
                    }
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="line"
                  onClick={() => set("bulkTiers", form.bulkTiers.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
        {errors.bulkTiers && (
          <p className="mt-1 text-[13px] font-medium text-bad">{errors.bulkTiers}</p>
        )}
      </section>

      {apiError && (
        <p role="alert" className="rounded-lg border border-bad bg-panel px-3 py-2 text-[13px] font-medium text-bad">
          {apiError}
        </p>
      )}

      <Button type="submit" variant="yellow" wide disabled={saving}>
        {saving ? "Saving…" : product ? "Save changes" : "Add listing"}
      </Button>
    </form>
  );
}

export default function ProductDialog({
  product,
  open,
  onClose,
  onSaved,
}: {
  product: SellerProductDto | null;
  open: boolean;
  onClose: () => void;
  onSaved: (product: SellerProductDto) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={product ? "Edit listing" : "Add a listing"} wide>
      {open && (
        <ProductForm
          key={product?.offerId ?? "new"}
          product={product}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}
