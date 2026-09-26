import { z } from "zod";

export const PayoutStatusSchema = z.enum([
  "PAYOUT_STATUS_UNSPECIFIED",
  "PAYOUT_STATUS_PENDING",
  "PAYOUT_STATUS_PROCESSING",
  "PAYOUT_STATUS_PAID",
  "PAYOUT_STATUS_FAILED",
  "PAYOUT_STATUS_CANCELLED",
]);

export const PayoutSchema = z.object({
  id: z.string(),
  claimId: z.string(),
  amountCents: z.string(),
  status: PayoutStatusSchema,
  failureReason: z.string().optional().default(""),
  currency: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const ListClaimPayoutsResponseSchema = z.object({
  payouts: z.array(PayoutSchema),
});

export type PayoutStatus = z.infer<typeof PayoutStatusSchema>;
export type Payout = z.infer<typeof PayoutSchema>;

export const TERMINAL_PAYOUT_STATUSES = [
  "PAYOUT_STATUS_PAID",
  "PAYOUT_STATUS_FAILED",
  "PAYOUT_STATUS_CANCELLED",
] as const satisfies readonly PayoutStatus[];
