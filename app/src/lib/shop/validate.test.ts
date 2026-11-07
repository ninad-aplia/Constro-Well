import { describe, expect, it } from "vitest";
import { COD_CAP, validateAddress, validateCod } from "./validate";

const validDraft = {
  name: "Rahul Menon",
  phone: "9845012345",
  pin: "560066",
  city: "Bengaluru",
  line: "Plot 22, Industrial Suburb",
};

describe("validateAddress", () => {
  it("accepts a fully valid address", () => {
    expect(validateAddress(validDraft)).toEqual({});
  });
  it("rejects a name under 2 characters", () => {
    expect(validateAddress({ ...validDraft, name: "R" })).toHaveProperty("name");
  });
  it("rejects a phone number not starting 6-9, or not 10 digits", () => {
    expect(validateAddress({ ...validDraft, phone: "5845012345" })).toHaveProperty("phone");
    expect(validateAddress({ ...validDraft, phone: "98450123" })).toHaveProperty("phone");
    expect(validateAddress({ ...validDraft, phone: "9845012345" })).not.toHaveProperty("phone");
  });
  it("rejects a pincode that isn't exactly 6 digits", () => {
    expect(validateAddress({ ...validDraft, pin: "56006" })).toHaveProperty("pin");
    expect(validateAddress({ ...validDraft, pin: "5600666" })).toHaveProperty("pin");
  });
  it("rejects a city under 2 characters", () => {
    expect(validateAddress({ ...validDraft, city: "B" })).toHaveProperty("city");
  });
  it("rejects an address line under 5 characters", () => {
    expect(validateAddress({ ...validDraft, line: "Flat" })).toHaveProperty("line");
  });
  it("trims whitespace before validating", () => {
    expect(validateAddress({ ...validDraft, name: "  Rahul Menon  " })).toEqual({});
  });
});

describe("validateCod", () => {
  it("allows a total at or below the COD cap", () => {
    expect(validateCod(COD_CAP)).toBeUndefined();
    expect(validateCod(COD_CAP - 1)).toBeUndefined();
  });
  it("blocks a total above the COD cap with a message", () => {
    expect(validateCod(COD_CAP + 1)).toBeTypeOf("string");
  });
});
