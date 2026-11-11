import { z } from "zod";

const addressFields = {
  label: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2, "Enter the recipient's name").max(80),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  line1: z.string().trim().min(5, "Enter the site or house address").max(200),
  city: z.string().trim().min(2, "Enter your town or city").max(80),
  state: z.string().trim().min(2, "Select a state").max(80),
  pin: z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit pincode"),
  isDefault: z.boolean(),
};

export const createAddressSchema = z
  .object({
    ...addressFields,
    label: addressFields.label.default("Home"),
    isDefault: addressFields.isDefault.default(false),
  })
  .strict();

export const updateAddressSchema = z
  .object(addressFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field" });

export const addressIdSchema = z.string().trim().min(1).max(100);

export const checkoutPreviewSchema = z.object({ addressId: addressIdSchema }).strict();

export const placeOrderSchema = z
  .object({
    addressId: addressIdSchema,
    paymentMethod: z.literal("COD").default("COD"),
  })
  .strict();

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "Idempotency-Key is required")
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "Invalid Idempotency-Key");

export const cancelOrderSchema = z
  .object({
    reason: z.string().trim().min(3, "Give a cancellation reason").max(300),
  })
  .strict();

// Only "damaged_goods" is a customer-initiated issue in the approved
// ShipmentIssueType vocabulary — "short_quantity" is system/driver-opened at
// delivery and "failed_attempt" is a pre-delivery driver report.
export const reportShipmentIssueSchema = z
  .object({
    type: z.literal("damaged_goods"),
    note: z.string().trim().min(3, "Describe the issue").max(500),
  })
  .strict();

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
export type ReportShipmentIssueInput = z.infer<typeof reportShipmentIssueSchema>;
