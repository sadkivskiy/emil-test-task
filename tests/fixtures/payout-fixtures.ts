import type { CustomWorld } from "../support/world.js";
import { requireClaimId } from "./claims-fixtures.js";
import {
  TERMINAL_PAYOUT_STATUSES,
  type Payout,
} from "../../src/services/payouts/payouts.schema.js";
import { waitForAnyPayout } from "../../src/services/payouts/polling.js";

export function rememberPayouts(world: CustomWorld, payouts: readonly Payout[]): void {
  world.payouts = [...payouts];
  const first = payouts[0];
  world.payoutId = first ? first.id : null;
}

export function requireLatestPayout(world: CustomWorld): Payout {
  const payout = world.payouts[world.payouts.length - 1];
  if (!payout) {
    throw new Error("No payout in world");
  }
  return payout;
}

export async function waitForPendingPayouts(world: CustomWorld): Promise<void> {
  const claimId = requireClaimId(world);
  const payouts = await waitForAnyPayout(claimId, world.payoutsClient);
  const pending = payouts.find(function (payout) {
    return !TERMINAL_PAYOUT_STATUSES.some(function (terminal) {
      return terminal === payout.status;
    });
  });
  if (!pending) {
    const last = payouts.map(function (payout) {
      return payout.status;
    });
    throw new Error(
      `Payout on claim ${claimId} was already terminal when it appeared. Last status: ${last.join(", ")}`,
    );
  }
  world.payouts = [...payouts];
  world.payoutId = pending.id;
}
