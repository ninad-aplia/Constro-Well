import { z } from "zod";

export const shipmentIdSchema = z.string().trim().min(1).max(100);

export const deliverSchema = z
  .object({
    otp: z.string().regex(/^\d{4}$/, "Enter the 4-digit delivery OTP"),
    deliveredQty: z.number().int().min(0).optional(),
  })
  .strict();

export const declineJobSchema = z
  .object({
    reason: z.string().trim().min(3, "Give a reason for declining").max(300),
  })
  .strict();

export const issueSchema = z
  .object({
    type: z.enum(["failed_attempt", "damaged_goods", "short_quantity"]),
    note: z.string().trim().min(3, "Describe the issue").max(300),
    deliveredQty: z.number().int().min(0).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === "short_quantity" && value.deliveredQty === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deliveredQty"],
        message: "Enter the quantity actually delivered",
      });
    }
  });
