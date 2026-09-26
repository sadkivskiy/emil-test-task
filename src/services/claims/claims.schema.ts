import { z } from "zod";

export const ClaimStatusSchema = z.enum([
  "CLAIM_STATUS_UNSPECIFIED",
  "CLAIM_STATUS_PENDING",
  "CLAIM_STATUS_UNDER_REVIEW",
  "CLAIM_STATUS_APPROVED",
  "CLAIM_STATUS_REJECTED",
]);

export const ClaimSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: ClaimStatusSchema,
  claimantId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  amountCents: z.string(),
  currency: z.string(),
});

export const CreateClaimSchema = z.object({
  title: z.string(),
  description: z.string(),
  claimantId: z.string(),
  amountCents: z.string(),
  currency: z.string().optional(),
});

export const UpdateClaimSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: ClaimStatusSchema.optional(),
});

export const ListClaimsResponseSchema = z.object({
  claims: z.array(ClaimSchema),
  nextPageToken: z.string().optional(),
  totalCount: z.number(),
});

export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type CreateClaim = z.infer<typeof CreateClaimSchema>;
export type UpdateClaim = z.infer<typeof UpdateClaimSchema>;
