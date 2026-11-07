import { beforeEach, describe, expect, it, vi } from "vitest";
import { advanceOrderStage, cancelOrder, getOrder, getOrders, makePreviewOrderId, saveOrder } from "./orders";
import type { Address, OrderPreview } from "@/lib/shop/types";

const addr: Address = { name: "Rahul Menon", phone: "9845012345", pin: "560066", city: "Bengaluru", line: "Plot 22", state: "Karnataka" };

function makeOrder(id: string, created: number): OrderPreview {
  return {
    id,
    created,
    items: [{ id: 0, name: "Test Cement", cat: "Cement", unit: "bag", q: 2, total: 780, seller: "Test Seller", art: "", hue: "#000" }],
    t: { sub: 780, ship: 199, disc: 0, total: 979, gst: 149.3, code: null },
    addr,
    pay: "Cash on delivery",
    eta: created + 86_400_000,
    stage: 0,
    times: [created],
    cancelled: false,
  };
}

describe("lib/api/orders (preview-order store)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty", async () => {
    expect(await getOrders()).toEqual([]);
    expect(await getOrder("BG-000000")).toBeNull();
  });

  it("saves and retrieves an order by id", async () => {
    const order = makeOrder("BG-100001", 1000);
    await saveOrder(order);
    expect(await getOrder("BG-100001")).toEqual(order);
  });

  it("lists orders newest-first", async () => {
    await saveOrder(makeOrder("BG-100001", 1000));
    await saveOrder(makeOrder("BG-100002", 2000));
    const orders = await getOrders();
    expect(orders.map((o) => o.id)).toEqual(["BG-100002", "BG-100001"]);
  });

  it("advanceOrderStage moves the order forward one stage and stamps the time", async () => {
    await saveOrder(makeOrder("BG-100001", 1000));
    const updated = await advanceOrderStage("BG-100001", 5000);
    expect(updated?.stage).toBe(1);
    expect(updated?.times).toEqual([1000, 5000]);
  });

  it("advanceOrderStage does nothing past the last stage", async () => {
    const order = { ...makeOrder("BG-100001", 1000), stage: 4 };
    await saveOrder(order);
    const updated = await advanceOrderStage("BG-100001", 5000);
    expect(updated?.stage).toBe(4);
    expect(updated?.times).toEqual([1000]);
  });

  it("advanceOrderStage does nothing on a cancelled order", async () => {
    const order = { ...makeOrder("BG-100001", 1000), cancelled: true };
    await saveOrder(order);
    const updated = await advanceOrderStage("BG-100001", 5000);
    expect(updated?.stage).toBe(0);
  });

  it("cancelOrder cancels before dispatch (stage < 2)", async () => {
    await saveOrder(makeOrder("BG-100001", 1000));
    const updated = await cancelOrder("BG-100001", 5000);
    expect(updated?.cancelled).toBe(true);
  });

  it("cancelOrder refuses to cancel at/after stage 2", async () => {
    const order = { ...makeOrder("BG-100001", 1000), stage: 2 };
    await saveOrder(order);
    const updated = await cancelOrder("BG-100001", 5000);
    expect(updated?.cancelled).toBe(false);
  });
});

describe("makePreviewOrderId", () => {
  it("generates an id in the BG-###### shape", () => {
    const id = makePreviewOrderId(new Set());
    expect(id).toMatch(/^BG-\d{6}$/);
  });

  it("retries on a collision with an existing id", () => {
    const collide = "BG-100000";
    const spy = vi
      .spyOn(Math, "random")
      .mockReturnValueOnce(0) // first attempt: 100000 + floor(0 * 899999) = 100000 -> collides
      .mockReturnValueOnce(0.5); // second attempt: a different id
    const id = makePreviewOrderId(new Set([collide]));
    expect(id).not.toBe(collide);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
