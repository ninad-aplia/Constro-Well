import { z } from "zod";

export const shipmentIdSchema = z.string().trim().min(1).max(100);

export const rejectSchema = z
  .object({ reason: z.string().trim().min(3, "Give a rejection reason").max(300) })
  .strict();

export const dispatchSchema = z
  .object({
    vehicleId: z.string().trim().min(1).max(100),
    slot: z.string().trim().min(1).max(100),
    challan: z.boolean(),
    invoice: z.boolean(),
    eway: z.string().trim().max(20).optional(),
    weighbridge: z.string().trim().max(50).optional(),
  })
  .strict();
