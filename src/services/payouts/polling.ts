import { PAYOUT_POLL_TIMEOUT_MS } from "../../config/timeouts.js";
import type { PayoutsClient } from "./payouts-client.js";
import {
  PayoutSchema,
  TERMINAL_PAYOUT_STATUSES,
  type Payout,
  type PayoutStatus,
} from "./payouts.schema.js";

function delay(ms: number): Promise<void> {
  return new Promise(function (resolve) {
    setTimeout(resolve, Math.max(0, ms));
  });
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}

function readField(data: unknown, field: string): unknown {
  if (!isRecord(data)) {
    return undefined;
  }
  return data[field];
}

function readStatus(data: unknown): string {
  const status = readField(data, "status");
  return typeof status === "string" ? status : "unparsed";
}

function shortPayoutStatus(status: string): string {
  const prefix = "PAYOUT_STATUS_";
  return status.startsWith(prefix) ? status.slice(prefix.length) : status;
}

function describeObservedStatuses(httpStatus: number, raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) {
    return httpStatus === 200 ? "no payout" : `no payout (HTTP ${httpStatus})`;
  }
  return raw.map((item: unknown) => shortPayoutStatus(readStatus(item))).join(", ");
}

function parsePayouts(raw: unknown): Payout[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((item: unknown) => {
    const parsed = PayoutSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

function isTerminal(status: PayoutStatus): boolean {
  return TERMINAL_PAYOUT_STATUSES.some((terminal) => terminal === status);
}

/**
 * `expectedStatus` waits for that status; otherwise any terminal status.
 * Throws after `timeoutMs` with the claim id and the last payout status, or `no payout`.
 * The claim status is not part of this wait.
 */
export async function waitForTerminalPayout(
  claimId: string,
  client: PayoutsClient,
  timeoutMs = PAYOUT_POLL_TIMEOUT_MS,
  intervalMs = 1_000,
  expectedStatus?: PayoutStatus,
): Promise<Payout> {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "no payout";

  while (Date.now() < deadline) {
    const response = await client.getClaimPayouts(claimId);
    const raw = readField(response.data, "payouts");
    lastStatus = describeObservedStatuses(response.status, raw);

    const payouts = parsePayouts(raw);
    const match = expectedStatus
      ? payouts.find((payout) => payout.status === expectedStatus)
      : payouts.find((payout) => isTerminal(payout.status));
    if (match) {
      return match;
    }

    await delay(Math.min(intervalMs, deadline - Date.now()));
  }

  const expected = expectedStatus ? shortPayoutStatus(expectedStatus) : "PAID|FAILED|CANCELLED";
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for a payout in status ${expected} for claim ${claimId}. Last payout status: ${lastStatus}`,
  );
}

/** Throws after `timeoutMs` with the claim id and the last status, or `no payout`. */
export async function waitForAnyPayout(
  claimId: string,
  client: PayoutsClient,
  timeoutMs = PAYOUT_POLL_TIMEOUT_MS,
  intervalMs = 1_000,
): Promise<Payout[]> {
  const deadline = Date.now() + timeoutMs;
  let lastObservation = "no payout";

  while (Date.now() < deadline) {
    const response = await client.getClaimPayouts(claimId);
    const raw = readField(response.data, "payouts");
    lastObservation = describeObservedStatuses(response.status, raw);
    const payouts = parsePayouts(raw);
    if (payouts.length > 0) {
      return payouts;
    }
    await delay(Math.min(intervalMs, deadline - Date.now()));
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for any payout on claim ${claimId}. Last: ${lastObservation}`,
  );
}

/**
 * Reads the payout by id, so it still works after the parent claim is deleted.
 * Throws after `timeoutMs` with the payout id and the last status.
 */
export async function waitForPayoutStatusById(
  payoutId: string,
  client: PayoutsClient,
  expectedStatus: PayoutStatus,
  timeoutMs = PAYOUT_POLL_TIMEOUT_MS,
  intervalMs = 1_000,
): Promise<Payout> {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "none";

  while (Date.now() < deadline) {
    const response = await client.getPayout(payoutId);
    const parsed = PayoutSchema.safeParse(response.data);
    lastStatus = parsed.success
      ? parsed.data.status
      : `HTTP ${response.status} ${readStatus(response.data)}`;

    if (parsed.success && parsed.data.status === expectedStatus) {
      return parsed.data;
    }

    await delay(Math.min(intervalMs, deadline - Date.now()));
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for payout ${payoutId} to become ${expectedStatus}. Last status: ${lastStatus}`,
  );
}

/** Throws after `timeoutMs` with the payout id and the last status. */
export async function waitForTerminalPayoutById(
  payoutId: string,
  client: PayoutsClient,
  timeoutMs = PAYOUT_POLL_TIMEOUT_MS,
  intervalMs = 1_000,
): Promise<Payout> {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "none";

  while (Date.now() < deadline) {
    const response = await client.getPayout(payoutId);
    const parsed = PayoutSchema.safeParse(response.data);
    lastStatus = parsed.success
      ? parsed.data.status
      : `HTTP ${response.status} ${readStatus(response.data)}`;

    if (parsed.success && isTerminal(parsed.data.status)) {
      return parsed.data;
    }

    await delay(Math.min(intervalMs, deadline - Date.now()));
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for payout ${payoutId} to become PAID|FAILED|CANCELLED. Last status: ${lastStatus}`,
  );
}

/**
 * Ignores payout ids in `knownIds`.
 * Throws after `timeoutMs` with the claim id and the ids seen so far.
 */
export async function waitForAdditionalPayout(
  claimId: string,
  client: PayoutsClient,
  knownIds: readonly string[],
  timeoutMs = PAYOUT_POLL_TIMEOUT_MS,
  intervalMs = 1_000,
): Promise<Payout[]> {
  const deadline = Date.now() + timeoutMs;
  const known = new Set(knownIds);
  let lastIds = "no payout";

  while (Date.now() < deadline) {
    const { httpStatus, payouts } = await readClaimPayouts(claimId, client);
    lastIds =
      payouts.length > 0
        ? payouts.map((payout) => payout.id).join(", ")
        : httpStatus === 200
          ? "no payout"
          : `no payout (HTTP ${httpStatus})`;
    if (payouts.some((payout) => !known.has(payout.id))) {
      return payouts;
    }
    await delay(Math.min(intervalMs, deadline - Date.now()));
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for a new payout on claim ${claimId}. Last ids: ${lastIds}`,
  );
}

/**
 * Holds the full window. The first empty list is not proof.
 * Throws as soon as a payout appears.
 */
export async function assertNoPayouts(
  claimId: string,
  client: PayoutsClient,
  timeoutMs = PAYOUT_POLL_TIMEOUT_MS,
  intervalMs = 1_000,
): Promise<void> {
  await watchClaimPayouts(claimId, client, timeoutMs, intervalMs, 0);
}

/** Holds the full window. Throws as soon as the count leaves `expectedCount`. */
export async function assertPayoutCountUnchanged(
  claimId: string,
  client: PayoutsClient,
  expectedCount: number,
  timeoutMs = PAYOUT_POLL_TIMEOUT_MS,
  intervalMs = 1_000,
): Promise<Payout[]> {
  const seen = await watchClaimPayouts(claimId, client, timeoutMs, intervalMs, expectedCount);
  return seen;
}

/** Holds the full window. Throws on the first status other than `expectedStatus`. */
export async function assertPayoutStatusHeld(
  payoutId: string,
  client: PayoutsClient,
  expectedStatus: PayoutStatus,
  timeoutMs = PAYOUT_POLL_TIMEOUT_MS,
  intervalMs = 1_000,
): Promise<Payout> {
  const deadline = Date.now() + timeoutMs;
  let last: Payout | undefined;

  while (true) {
    const response = await client.getPayout(payoutId);
    const parsed = PayoutSchema.safeParse(response.data);
    if (!parsed.success || parsed.data.status !== expectedStatus) {
      const lastStatus = parsed.success
        ? parsed.data.status
        : `HTTP ${response.status} ${readStatus(response.data)}`;
      throw new Error(
        `Payout ${payoutId} left ${expectedStatus} within ${timeoutMs}ms. Last status: ${lastStatus}`,
      );
    }
    last = parsed.data;
    if (Date.now() >= deadline) {
      return last;
    }
    await delay(Math.min(intervalMs, deadline - Date.now()));
  }
}

async function readClaimPayouts(
  claimId: string,
  client: PayoutsClient,
): Promise<{ httpStatus: number; payouts: Payout[] }> {
  const response = await client.getClaimPayouts(claimId);
  return {
    httpStatus: response.status,
    payouts: parsePayouts(readField(response.data, "payouts")),
  };
}

async function watchClaimPayouts(
  claimId: string,
  client: PayoutsClient,
  timeoutMs: number,
  intervalMs: number,
  expectedCount?: number,
): Promise<Payout[]> {
  const deadline = Date.now() + timeoutMs;
  let last: Payout[] = [];

  while (true) {
    const { httpStatus, payouts } = await readClaimPayouts(claimId, client);
    if (httpStatus !== 200) {
      throw new Error(
        `Claim ${claimId} payout list returned HTTP ${httpStatus} while watching for ${timeoutMs}ms`,
      );
    }
    if (expectedCount !== undefined && payouts.length !== expectedCount) {
      const ids = payouts.map((payout) => payout.id).join(", ");
      throw new Error(
        `Payout count on claim ${claimId} became ${payouts.length}, expected ${expectedCount}, within ${timeoutMs}ms. Ids: [${ids}]`,
      );
    }
    last = payouts;
    if (Date.now() >= deadline) {
      return last;
    }
    await delay(Math.min(intervalMs, deadline - Date.now()));
  }
}
