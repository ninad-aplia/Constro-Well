import type { SellerShipmentDto } from "@/lib/api/sellerOrderDto";
import type { SellerOrder } from "@/lib/seller/types";

function dueLabel(value: string | null): string | undefined {
  if (!value) return undefined;
  const diff = Date.parse(value) - Date.now();
  if (!Number.isFinite(diff)) return undefined;
  if (diff <= 0) return "overdue";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

function dateLabel(value: string | null): string | undefined {
  if (!value) return undefined;
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function toSellerOrder(shipment: SellerShipmentDto): SellerOrder {
  const lines = shipment.lines;
  const qty = lines.reduce((sum, line) => sum + line.qty, 0);
  const itemValue = lines.reduce((sum, line) => sum + Number(line.lineValue), 0);
  const first = lines[0];
  return {
    id: shipment.orderCode,
    shipmentId: shipment.id,
    orderCode: shipment.orderCode,
    buyer: shipment.buyerName,
    city: shipment.buyerCity,
    pin: shipment.buyerPin,
    productId: first?.productId ?? "",
    productName: first?.name ?? "Shipment items",
    productCategory: first?.category ?? "Cement",
    unit: first?.unit ?? "unit",
    price: qty > 0 ? itemValue / qty : 0,
    qty,
    weightKg: first?.weightKg ?? 0,
    bulk: lines.some((line) => line.bulk),
    createdLabel: dateLabel(shipment.createdAt) ?? "",
    status: shipment.status as SellerOrder["status"],
    acceptByLabel: dueLabel(shipment.acceptBy),
    dispatchByLabel: dueLabel(shipment.dispatchBy),
    late: shipment.late,
    slot: shipment.slot ?? undefined,
    vehicleId: shipment.vehicleId ?? undefined,
    docs: {
      challan: shipment.docs.challan,
      invoice: shipment.docs.invoice,
      eway: shipment.docs.eway ?? undefined,
      weighbridge: shipment.docs.weighbridge ?? undefined,
    },
    deliveredAtLabel: dateLabel(shipment.deliveredAt),
    reviewEndsLabel: dueLabel(shipment.reviewEnds),
    issue: shipment.issue
      ? {
          type: shipment.issue.type,
          note: shipment.issue.note,
          claim: shipment.issue.claim ? Number(shipment.issue.claim) : undefined,
        }
      : undefined,
    paidAtLabel: undefined,
    withdrawn: false,
    events: shipment.events.map((event) => ({
      at: dateLabel(event.at) ?? "",
      message: event.message,
    })),
    itemValue,
    lines: lines.map((line) => ({
      id: line.id,
      name: line.name,
      qty: line.qty,
      unit: line.unit,
      unitPrice: Number(line.unitPrice),
      lineValue: Number(line.lineValue),
      weightKg: line.weightKg,
    })),
  };
}
