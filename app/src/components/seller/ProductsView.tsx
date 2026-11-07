// Seller Hub Products — port of buildgrid-seller-dashboard.html's
// viewProducts() (line 356): stock stepper (+/-10, auto-pause at 0),
// active/paused toggle, low-stock tab, add/edit dialog. Initial tab/dialog
// state comes from the server-parsed URL (see app/seller/products/page.tsx)
// rather than `useSearchParams()` — see OrdersView's header comment for why.
"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Pill from "@/components/ui/Pill";
import Stepper from "@/components/ui/Stepper";
import CategoryThumb from "./CategoryThumb";
import PreviewDisclosure from "./PreviewDisclosure";
import ProductDialog from "./ProductDialog";
import SellerIcon from "./SellerIcon";
import { useSellerStore } from "./SellerStoreProvider";
import { getLowStockProducts } from "@/lib/seller/selectors";
import type { SellerProduct } from "@/lib/seller/types";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function ProductsView({ initialTab, initialDialogOpen }: { initialTab: string; initialDialogOpen: boolean }) {
  const { state, setStock, toggleProductStatus } = useSellerStore();
  const [tab, setTab] = useState(initialTab);
  const [editing, setEditing] = useState<SellerProduct | null>(null);
  const [dialogOpen, setDialogOpen] = useState(initialDialogOpen);

  const lowStock = getLowStockProducts(state);
  let products = state.products;
  if (tab === "active") products = products.filter((p) => p.status === "active");
  if (tab === "paused") products = products.filter((p) => p.status === "paused");
  if (tab === "low") products = products.filter((p) => p.stock <= p.reorderLevel);

  const active = state.products.filter((p) => p.status === "active").length;
  const paused = state.products.filter((p) => p.status === "paused").length;

  return (
    <div className="grid gap-4">
      <PreviewDisclosure />

      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Products and inventory</h1>
          <p className="mt-1 text-muted">Keep stock accurate. Out-of-stock listings are paused automatically so you never miss a promised delivery.</p>
        </div>
        <Button
          variant="yellow"
          icon={<SellerIcon name="plus" size={16} />}
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          Add product
        </Button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[
          { key: "", label: "All", count: state.products.length },
          { key: "active", label: "Active", count: active },
          { key: "paused", label: "Paused", count: paused },
          { key: "low", label: "Low stock", count: lowStock.length },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={tab === f.key}
            onClick={() => setTab(f.key)}
            className={`flex flex-none items-center gap-1.5 rounded-[10px] border px-3.5 py-2 text-sm font-semibold whitespace-nowrap ${
              tab === f.key ? "border-nav bg-nav text-white" : "border-line bg-panel"
            }`}
          >
            {f.label}
            <span className={`rounded-[9px] px-1.5 text-xs ${tab === f.key ? "bg-white/20" : "bg-tint"}`}>{f.count}</span>
          </button>
        ))}
      </div>

      <section className="overflow-x-auto rounded-2xl border border-line bg-panel">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr>
              <th className="border-b border-line px-3 py-2.5 text-left text-[13px] font-semibold text-muted">Product</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[13px] font-semibold text-muted">Price</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[13px] font-semibold text-muted">Stock</th>
              <th className="border-b border-line px-3 py-2.5 text-left text-[13px] font-semibold text-muted">Status</th>
              <th className="border-b border-line px-3 py-2.5 text-right text-[13px] font-semibold text-muted">Sold, 30 days</th>
              <th className="border-b border-line px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted">
                  No products in this view.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id}>
                  <td className="border-b border-line px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <CategoryThumb category={p.category} />
                      <div>
                        <b>{p.name}</b>
                        <span className="block text-[13px] text-muted">
                          Min order {p.minOrderQty} · {p.weightKg} kg per {p.unit}
                          {p.bulk ? " · bulk goods" : ""}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-line px-3 py-2.5 text-right">
                    <b>{inr(p.price)}</b>
                    <br />
                    <span className="text-[13px] text-muted">
                      <s>{inr(p.mrp)}</s> · {Math.round((1 - p.price / p.mrp) * 100)}% off
                    </span>
                  </td>
                  <td className="border-b border-line px-3 py-2.5 text-right">
                    <div className="flex justify-end">
                      <Stepper value={p.stock} min={0} step={10} label={`Stock for ${p.name}`} onChange={(v) => setStock(p.id, v)} />
                    </div>
                    {p.stock <= p.reorderLevel && (
                      <Pill tone={p.stock === 0 ? "bad" : "warn"} className="mt-1">
                        {p.stock === 0 ? "Out of stock" : "Low stock"}
                      </Pill>
                    )}
                  </td>
                  <td className="border-b border-line px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={p.status === "active"}
                        aria-label={`${p.status === "active" ? "Pause" : "Activate"} ${p.name}`}
                        onClick={() => toggleProductStatus(p.id)}
                        className={`relative h-6 w-[42px] flex-none rounded-xl ${p.status === "active" ? "bg-ok" : "bg-line"}`}
                      >
                        <span
                          className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-[left] ${
                            p.status === "active" ? "left-[21px]" : "left-[3px]"
                          }`}
                        />
                      </button>
                      <span className="text-[13px] text-muted">{p.status === "active" ? "Live" : "Paused"}</span>
                    </div>
                  </td>
                  <td className="border-b border-line px-3 py-2.5 text-right">{p.sold.toLocaleString("en-IN")}</td>
                  <td className="border-b border-line px-3 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="line"
                      onClick={() => {
                        setEditing(p);
                        setDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <ProductDialog product={editing} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
