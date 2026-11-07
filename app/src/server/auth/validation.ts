// Zod schemas for the authentication boundary. `.strict()` rejects unknown
// keys, so a client cannot smuggle `role: "admin"` into public registration.
import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Email is required")
  .transform((value) => value.toLowerCase())
  .pipe(z.string().email("Enter a valid email address").max(254, "Email is too long"));

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

const phone = z
  .union([z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"), z.literal("")])
  .optional();

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(80, "Name is too long"),
    email,
    password,
    phone,
  })
  .strict();

export const loginSchema = z
  .object({
    email,
    password: z.string().min(1, "Password is required").max(72, "Password is too long"),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
