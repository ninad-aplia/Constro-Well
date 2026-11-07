// Seller Hub Products — same prototype layout, now backed by the authenticated
// PostgreSQL inventory API. Product/stock/status changes persist through
// `/api/seller/products*`; the seller identity comes from the session cookie,
// never from a client-supplied id.
"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Pill from "@/components/ui/Pill";
import Stepper from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/Toast";
import CategoryThumb from "./CategoryThumb";
import PreviewDisclosure from "./PreviewDisclosure";
import ProductDialog from "./ProductDialog";
import SellerIcon from "./SellerIcon";
import { ApiClientError } from "@/lib/api/client";
import { fetchSellerProducts, updateSellerProduct, updateSellerStock } from "@/lib/api/sellerApi";
import type { SellerProductDto } from "@/lib/api/dto";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return "Sign in as a seller to manage inventory.";
    if (error.status === 403) return "This account does not have a seller profile.";
    return error.message;
  }
  return "Could not reach the inventory service. Try again.";
}

type LoadState = "loading" | "ready" | "error";

export default function ProductsView({ initialTab, initialDialogOpen }: { initialTab: string; initialDialogOpen: boolean }) {
  const toast = useToast();
  const [products, setProducts] = useState<SellerProductDto[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [tab, setTab] = useState(initialTab);
  const [editing, setEditing] = useState<SellerProductDto | null>(null);
  const [dialogOpen, setDialogOpen] = useState(initialDialogOpen);

  useEffect(() => {
    let cancelled = false;
    fetchSellerProducts()
      .then((list) => {
        if (cancelled) return;
        setProducts(list);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(messageOf(err));
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = () => {
    setState("loading");
    setError("");
    setReloadToken((value) => value + 1);
  };

  const lowStock = products.filter((product) => product.stock <= product.reorderLevel);
  let visible = products;
  if (tab === "active") visible = products.filter((product) => product.status === "active");
  if (tab === "paused") visible = products.filter((product) => product.status === "paused");
  if (tab === "low") visible = lowStock;

  const active = products.filter((product) => product.status === "active").length;
  const paused = products.filter((product) => product.status === "paused").length;

  const replace = (updated: SellerProductDto) =>
    setProducts((current) =>
      current.map((product) => (product.offerId === updated.offerId ? updated : product)),
    );

  const handleStock = (product: SellerProductDto, stock: number) => {
    updateSellerStock(product.offerId, stock)
      .then((updated) => {
        replace(updated);
        if (stock === 0) toast.show("Out of stock, listing paused");
      })
      .catch((err: unknown) => toast.show(messageOf(err)));
  };

  const handleToggle = (product: SellerProductDto) => {
    const next = product.status === "active" ? "paused" : "active";
    updateSellerProduct(product.offerId, { status: next })
      .then((updated) => {
        replace(updated);
        toast.show(`${product.name.split(",")[0]} is ${next === "active" ? "live" : "paused"}`);
      })
      .catch((err: unknown) => toast.show(messageOf(err)));
  };

  const handleSaved = (saved: SellerProductDto) => {
    setProducts((current) =>
      current.some((product) => product.offerId === saved.offerId)
        ? current.map((product) => (product.offerId === saved.offerId ? saved : product))
        : [saved, ...current],
    );
    toast.show("Listing saved");
  };

  return (
    <div className="grid gap-4">
      <PreviewDisclosure message="Product prices, stock and status are saved to the marketplace database. Other Seller Hub screens still use preview data." />

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
          Add listing
        </Button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[
          { key: "", label: "All", count: products.length },
          { key: "active", label: "Active", count: active },
          { key: "paused", label: "Paused", count: paused },
          { key: "low", label: "Low stock", count: lowStock.length },
        ].map((filter) => (
          <button
            key={filter.key}
            type="button"
            aria-pressed={tab === filter.key}
            onClick={() => setTab(filter.key)}
            className={`flex flex-none items-center gap-1.5 rounded-[10px] border px-3.5 py-2 text-sm font-semibold whitespace-nowrap ${
              tab === filter.key ? "border-nav bg-nav text-white" : "border-line bg-panel"
            }`}
          >
            {filter.label}
            <span className={`rounded-[9px] px-1.5 text-xs ${tab === filter.key ? "bg-white/20" : "bg-tint"}`}>{filter.count}</span>
          </button>
        ))}
      </div>

      {state === "error" ? (
        <section role="alert" className="grid justify-items-center gap-2 rounded-2xl border border-line bg-panel p-8 text-center">
          <h2 className="font-display text-lg font-bold">Could not load inventory</h2>
          <p className="text-muted">{error}</p>
          <Button variant="line" onClick={reload}>
            Retry
          </Button>
        </section>
      ) : state === "loading" ? (
        <section aria-busy="true" className="grid gap-2 rounded-2xl border border-line bg-panel p-6">
          <div className="h-6 w-56 animate-pulse rounded bg-tint" />
          <div className="h-10 w-full animate-pulse rounded bg-tint" />
          <div className="h-10 w-full animate-pulse rounded bg-tint" />
          <p className="sr-only">Loading seller inventory.</p>
        </section>
      ) : (
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
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted">
                    {products.length === 0 ? "No listings yet. Add your first listing." : "No products in this view."}
                  </td>
                </tr>
              ) : (
                visible.map((product) => (
                  <tr key={product.offerId}>
                    <td className="border-b border-line px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <CategoryThumb category={product.category} />
                        <div>
                          <b>{product.name}</b>
                          <span className="block text-[13px] text-muted">
                            Min order {product.minOrderQty} · {product.unitWeightKg} kg per {product.unit}
                            {product.bulkFlag ? " · bulk goods" : ""} · Lead {product.leadTimeDays} day
                            {product.leadTimeDays === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-line px-3 py-2.5 text-right">
                      <b>{inr(Number(product.price))}</b>
                      <br />
                      <span className="text-[13px] text-muted">
                        <s>{inr(Number(product.mrp))}</s> · {Math.round((1 - Number(product.price) / Number(product.mrp)) * 100)}% off
                      </span>
                    </td>
                    <td className="border-b border-line px-3 py-2.5 text-right">
                      <div className="flex justify-end">
                        <Stepper value={product.stock} min={0} step={10} label={`Stock for ${product.name}`} onChange={(value) => handleStock(product, value)} />
                      </div>
                      {product.stock <= product.reorderLevel && (
                        <Pill tone={product.stock === 0 ? "bad" : "warn"} className="mt-1">
                          {product.stock === 0 ? "Out of stock" : "Low stock"}
                        </Pill>
                      )}
                    </td>
                    <td className="border-b border-line px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={product.status === "active"}
                          aria-label={`${product.status === "active" ? "Pause" : "Activate"} ${product.name}`}
                          onClick={() => handleToggle(product)}
                          className={`relative h-6 w-[42px] flex-none rounded-xl ${product.status === "active" ? "bg-ok" : "bg-line"}`}
                        >
                          <span
                            className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-[left] ${
                              product.status === "active" ? "left-[21px]" : "left-[3px]"
                            }`}
                          />
                        </button>
                        <span className="text-[13px] text-muted">{product.status === "active" ? "Live" : "Paused"}</span>
                      </div>
                    </td>
                    <td className="border-b border-line px-3 py-2.5 text-right">{product.soldCount.toLocaleString("en-IN")}</td>
                    <td className="border-b border-line px-3 py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="line"
                        onClick={() => {
                          setEditing(product);
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
      )}

      <ProductDialog
        product={editing}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
