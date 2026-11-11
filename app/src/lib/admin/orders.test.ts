import { describe, expect, it } from "vitest";
import { formatInrAmount, orderStageTone, shipmentStatusTone } from "./orders";

describe("order presentation helpers", () => {
  it("maps only stored stages and shipment statuses, falling back neutrally", () => {
    expect(orderStageTone("delivered")).toBe("ok");
    expect(orderStageTone("out_for_delivery")).toBe("warn");
    expect(orderStageTone("unknown")).toBe("neutral");
    expect(shipmentStatusTone("disputed")).toBe("bad");
    expect(shipmentStatusTone("settled")).toBe("ok");
    expect(shipmentStatusTone("anything")).toBe("neutral");
  });

  it("renders exact decimal amounts without float conversion", () => {
    expect(formatInrAmount("91250.00")).toBe("₹91250.00");
  });
});
