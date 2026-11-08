// Seller Hub preview-state store — ported from buildgrid-seller-dashboard.html's
// action handlers (`A.accept/reject/dispatch/stk/pstatus/...`). Client-side
// React state only: there is no seller backend to persist to in this phase,
// so every mutation here is explicitly a local preview change (lost on
// reload), never a claim of real/remote persistence. No localStorage either —
// kept deliberately in-memory so that's unambiguous.
"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";
import { DISPATCH_WINDOW_HOURS } from "@/lib/seller/rules";
import type {
  NotificationPreferences,
  SellerOrderDocs,
  SellerProduct,
  SellerState,
} from "@/lib/seller/types";

export interface DispatchInput {
  vehicleId: string;
  slot: string;
  challan: boolean;
  invoice: boolean;
  eway?: string;
  weighbridge?: string;
}

export interface ProductInput {
  name: string;
  category: string;
  unit: string;
  mrp: number;
  price: number;
  stock: number;
  minOrderQty: number;
  weightKg: number;
  reorderLevel: number;
  bulk: boolean;
}

export interface VehicleInput {
  regNumber: string;
  type: string;
  driverName: string;
  driverPhone: string;
}

interface SellerStoreValue {
  state: SellerState;
  acceptOrder: (id: string) => void;
  rejectOrder: (id: string, reason: string) => void;
  markPacked: (id: string) => void;
  dispatchOrder: (id: string, input: DispatchInput) => void;
  adjustStock: (productId: string, delta: number) => void;
  setStock: (productId: string, value: number) => void;
  toggleProductStatus: (productId: string) => void;
  addProduct: (input: ProductInput) => void;
  editProduct: (productId: string, input: ProductInput) => void;
  addVehicle: (input: VehicleInput) => boolean;
  removeVehicle: (id: string) => void;
  markAllNotificationsRead: () => void;
  togglePreference: (key: keyof NotificationPreferences) => void;
}

const Ctx = createContext<SellerStoreValue | null>(null);

export function useSellerStore(): SellerStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSellerStore must be used within SellerStoreProvider");
  return ctx;
}

export default function SellerStoreProvider({
  initialState,
  children,
}: {
  initialState: SellerState;
  children: ReactNode;
}) {
  const [state, setState] = useState(initialState);
  const toast = useToast();

  const pauseIfOutOfStock = (p: SellerProduct): SellerProduct =>
    p.stock === 0 && p.status === "active" ? { ...p, status: "paused" } : p;

  const acceptOrder = useCallback(
    (id: string) => {
      if (state.vacationMode) {
        toast.show("Turn off vacation mode first");
        return;
      }
      const order = state.orders.find((o) => o.id === id);
      if (!order) return;
      const product = state.products.find((p) => p.id === order.productId);
      if (product && product.stock < order.qty) {
        toast.show(
          `Not enough stock: you have ${product.stock}, this order needs ${order.qty}. Update stock first, or reject.`
        );
        return;
      }
      setState({
        ...state,
        stats: { ...state.stats, accepted: state.stats.accepted + 1 },
        products: state.products.map((p) =>
          p.id === order.productId ? { ...p, stock: Math.max(0, p.stock - order.qty) } : p
        ),
        orders: state.orders.map((o) =>
          o.id === id
            ? {
                ...o,
                status: "accepted" as const,
                acceptByLabel: undefined,
                dispatchByLabel: `${DISPATCH_WINDOW_HOURS}h left`,
                events: [
                  ...o.events,
                  { at: "Just now", message: `Accepted, dispatch within ${DISPATCH_WINDOW_HOURS} hours` },
                ],
              }
            : o
        ),
      });
      toast.show(`Accepted. Dispatch within ${DISPATCH_WINDOW_HOURS} hours.`);
    },
    [state, toast]
  );

  const rejectOrder = useCallback(
    (id: string, reason: string) => {
      setState({
        ...state,
        orders: state.orders.map((o) =>
          o.id === id
            ? {
                ...o,
                status: "rejected" as const,
                issue: { type: "Rejected", note: reason },
                events: [...o.events, { at: "Just now", message: `Rejected: ${reason}` }],
              }
            : o
        ),
      });
      toast.show("Rejected. Sent to admin to reassign.");
    },
    [state, toast]
  );

  const markPacked = useCallback(
    (id: string) => {
      setState({
        ...state,
        orders: state.orders.map((o) =>
          o.id === id
            ? { ...o, status: "packed" as const, events: [...o.events, { at: "Just now", message: "Packed and ready for pickup" }] }
            : o
        ),
      });
      toast.show("Marked as packed.");
    },
    [state, toast]
  );

  const dispatchOrder = useCallback(
    (id: string, input: DispatchInput) => {
      const order = state.orders.find((o) => o.id === id);
      const vehicle = state.vehicles.find((v) => v.id === input.vehicleId);
      if (!order || !vehicle) return;
      const docs: SellerOrderDocs = { challan: input.challan, invoice: input.invoice };
      if (input.eway) docs.eway = input.eway;
      if (input.weighbridge) docs.weighbridge = input.weighbridge;
      setState({
        ...state,
        stats: {
          ...state.stats,
          dispatched: state.stats.dispatched + 1,
          ontime: order.late ? state.stats.ontime : state.stats.ontime + 1,
        },
        orders: state.orders.map((o) =>
          o.id === id
            ? {
                ...o,
                status: "dispatched" as const,
                vehicleId: vehicle.id,
                slot: input.slot,
                docs,
                dispatchByLabel: undefined,
                events: [
                  ...o.events,
                  {
                    at: "Just now",
                    message: `Dispatched with ${vehicle.regNumber}${o.late ? " (late)" : ""}, customer OTP generated`,
                  },
                ],
              }
            : o
        ),
      });
      toast.show("Dispatched. The customer received a delivery OTP.");
    },
    [state, toast]
  );

  const adjustStock = useCallback(
    (productId: string, delta: number) => {
      setState({
        ...state,
        products: state.products.map((p) =>
          p.id === productId ? pauseIfOutOfStock({ ...p, stock: Math.max(0, p.stock + delta) }) : p
        ),
      });
      const next = state.products.find((p) => p.id === productId);
      if (next) {
        const updatedStock = Math.max(0, next.stock + delta);
        toast.show(updatedStock === 0 ? "Out of stock, listing paused" : `Stock updated to ${updatedStock}`);
      }
    },
    [state, toast]
  );

  const setStock = useCallback(
    (productId: string, value: number) => {
      const clamped = Math.max(0, Math.round(value) || 0);
      setState({
        ...state,
        products: state.products.map((p) => (p.id === productId ? pauseIfOutOfStock({ ...p, stock: clamped }) : p)),
      });
      toast.show(clamped === 0 ? "Out of stock, listing paused" : `Stock updated to ${clamped}`);
    },
    [state, toast]
  );

  const toggleProductStatus = useCallback(
    (productId: string) => {
      const product = state.products.find((p) => p.id === productId);
      if (!product) return;
      if (product.status === "paused" && product.stock <= 0) {
        toast.show("Add stock before activating");
        return;
      }
      const nextStatus = product.status === "active" ? "paused" : "active";
      setState({
        ...state,
        products: state.products.map((p) => (p.id === productId ? { ...p, status: nextStatus } : p)),
      });
      toast.show(`${product.name.split(",")[0]} is ${nextStatus === "active" ? "live" : "paused"}`);
    },
    [state, toast]
  );

  const addProduct = useCallback(
    (input: ProductInput) => {
      const id = `p${Date.now()}`;
      setState({
        ...state,
        products: [{ id, status: "active", sold: 0, ...input }, ...state.products],
      });
      toast.show("Product added and live in search");
    },
    [state, toast]
  );

  const editProduct = useCallback(
    (productId: string, input: ProductInput) => {
      setState({
        ...state,
        products: state.products.map((p) => (p.id === productId ? { ...p, ...input } : p)),
      });
      toast.show("Product updated");
    },
    [state, toast]
  );

  const addVehicle = useCallback(
    (input: VehicleInput): boolean => {
      const regNumber = input.regNumber.toUpperCase().replace(/[\s-]/g, "");
      if (!/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/.test(regNumber)) return false;
      if (state.vehicles.some((v) => v.regNumber === regNumber)) return false;
      const driverId = `d${Date.now()}`;
      setState({
        ...state,
        drivers: [...state.drivers, { id: driverId, name: input.driverName, phone: input.driverPhone }],
        vehicles: [...state.vehicles, { id: `v${Date.now()}`, regNumber, type: input.type, driverId }],
      });
      toast.show("Vehicle added");
      return true;
    },
    [state, toast]
  );

  const removeVehicle = useCallback(
    (id: string) => {
      setState({ ...state, vehicles: state.vehicles.filter((v) => v.id !== id) });
      toast.show("Vehicle removed");
    },
    [state, toast]
  );

  const markAllNotificationsRead = useCallback(() => {
    setState({ ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) });
  }, [state]);

  const togglePreference = useCallback(
    (key: keyof NotificationPreferences) => {
      setState({ ...state, preferences: { ...state.preferences, [key]: !state.preferences[key] } });
    },
    [state]
  );

  return (
    <Ctx.Provider
      value={{
        state,
        acceptOrder,
        rejectOrder,
        markPacked,
        dispatchOrder,
        adjustStock,
        setStock,
        toggleProductStatus,
        addProduct,
        editProduct,
        addVehicle,
        removeVehicle,
        markAllNotificationsRead,
        togglePreference,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
