import type { AxiosResponse } from "axios";

import type { CustomWorld } from "../support/world.js";
import {
  ClaimSchema,
  ClaimStatusSchema,
  ListClaimsResponseSchema,
  type Claim,
  type ClaimStatus,
  type CreateClaim,
} from "../../src/services/claims/claims.schema.js";

export function requireClaimId(world: CustomWorld): string {
  if (!world.claimId) {
    throw new Error("No claimId in world");
  }
  return world.claimId;
}

export function requireClaim(world: CustomWorld): Claim {
  if (world.response === null) {
    throw new Error("No response in world");
  }
  return ClaimSchema.parse(world.response.data);
}

export function uniqueClaimantId(): string {
  return `sdet-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function trackClaimId(world: CustomWorld, id: unknown): void {
  if (typeof id !== "string" || id.length === 0) {
    return;
  }
  world.claimId = id;
  if (!world.createdClaimIds.includes(id)) {
    world.createdClaimIds.push(id);
  }
}

function readId(data: unknown): unknown {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }
  return Object.fromEntries(Object.entries(data))["id"];
}

export function omitClaimField(body: CreateClaim, field: string): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === field || typeof value !== "string") {
      continue;
    }
    payload[key] = value;
  }
  return payload;
}

export async function createClaim(
  world: CustomWorld,
  overrides: Partial<CreateClaim> = {},
): Promise<AxiosResponse<unknown>> {
  const payload: CreateClaim = {
    title: overrides.title ?? `sdet-claim-${Date.now()}`,
    description: overrides.description ?? "Created by cucumber steps",
    claimantId: overrides.claimantId ?? uniqueClaimantId(),
    amountCents: overrides.amountCents ?? "100000",
    currency: overrides.currency ?? "EUR",
  };
  world.response = await world.claims.createClaim(payload);
  trackClaimId(world, readId(world.response.data));
  return world.response;
}

export async function ensureClaimStatus(world: CustomWorld, status: string): Promise<void> {
  const id = requireClaimId(world);
  const requested: ClaimStatus = ClaimStatusSchema.parse(status);
  const current = world.response === null ? null : ClaimSchema.safeParse(world.response.data);
  if (!current?.success || current.data.status !== requested) {
    await world.claims.updateClaim(id, { status: requested });
  }
  world.response = await world.claims.getClaim(id);
  ClaimSchema.parse(world.response.data);
}

export async function ensureAtLeastClaims(world: CustomWorld, minCount: number): Promise<void> {
  const pageSize = Math.max(minCount + 20, 50);
  const maxCreates = minCount + 10;
  let creates = 0;
  let listed = await world.claims.listClaims({ pageSize });
  let claims = ListClaimsResponseSchema.parse(listed.data).claims;
  while (claims.length < minCount && creates < maxCreates) {
    await createClaim(world);
    creates += 1;
    listed = await world.claims.listClaims({ pageSize });
    claims = ListClaimsResponseSchema.parse(listed.data).claims;
  }
  world.response = listed;
}
