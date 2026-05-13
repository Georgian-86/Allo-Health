import { z } from "zod";

export const reserveRequestSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().positive(),
  idempotencyKey: z.string().optional(),
});

export const confirmRequestSchema = z.object({
  reservationId: z.string().min(1),
});

export const releaseRequestSchema = z.object({
  reservationId: z.string().min(1),
});

export type ReserveRequest = z.infer<typeof reserveRequestSchema>;
export type ConfirmRequest = z.infer<typeof confirmRequestSchema>;
export type ReleaseRequest = z.infer<typeof releaseRequestSchema>;
