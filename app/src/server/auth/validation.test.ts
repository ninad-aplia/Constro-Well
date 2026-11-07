import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./validation";

describe("auth validation", () => {
  it("accepts a valid registration and normalizes the email", () => {
    const parsed = registerSchema.safeParse({
      name: "Test User",
      email: "  TEST@Example.COM ",
      password: "CorrectHorse9",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("test@example.com");
  });

  it("rejects a role field on public registration", () => {
    const parsed = registerSchema.safeParse({
      name: "Test User",
      email: "test@example.com",
      password: "CorrectHorse9",
      role: "admin",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects short passwords and invalid emails", () => {
    expect(
      registerSchema.safeParse({
        name: "Test User",
        email: "not-an-email",
        password: "CorrectHorse9",
      }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        name: "Test User",
        email: "test@example.com",
        password: "short",
      }).success,
    ).toBe(false);
  });

  it("requires a password on login", () => {
    expect(
      loginSchema.safeParse({ email: "test@example.com", password: "" }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ email: "test@example.com", password: "x" }).success,
    ).toBe(true);
  });
});
