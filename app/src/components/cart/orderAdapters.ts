// Compatibility adapter: existing customer order components render the
// prototype `OrderPreview` shape, while the API returns the persisted Order DTO.
import type { OrderDto } from "@/lib/api/orderDto";
import type { Category, OrderPreview } from "@/lib/shop/types";

export function toOrderPreview(order: OrderDto): OrderPreview {
  const created = Date.parse(order.createdAt);
  return {
    id: order.code,
    created,
    items: order.lines.map((line) => ({
      id: Number(line.productCode),
      name: line.name,
      cat: line.category as Category,
      unit: line.unit,
      q: line.qty,
      total: Number(line.lineValue),
      seller: line.sellerName,
      art: line.art,
      hue: line.hue,
    })),
    t: {
      sub: Number(order.totals.subtotal),
      ship: Number(order.totals.deliveryFee),
      disc: Number(order.totals.discount),
      total: Number(order.totals.total),
      gst: Number(order.totals.taxAmount),
      code: order.couponCode,
    },
    addr: {
      name: order.address.name,
      phone: order.address.phone,
      pin: order.address.pin,
      line: order.address.line1,
      city: order.address.city,
      state: order.address.state,
      def: order.address.isDefault,
    },
    pay: order.paymentLabel,
    eta: created + 3 * 86_400_000,
    stage: order.stage,
    times: [created],
    cancelled: order.cancelled,
  };
}
