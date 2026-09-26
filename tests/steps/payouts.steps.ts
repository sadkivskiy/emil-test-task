import { Given, Then, When } from "@cucumber/cucumber";
import { expect } from "chai";

import type { CustomWorld } from "../support/world.js";
import { requireResponse } from "../support/require-response.js";
import { createClaim, ensureClaimStatus, requireClaimId } from "../fixtures/claims-fixtures.js";
import {
  rememberPayouts,
  requireLatestPayout,
  waitForPendingPayouts,
} from "../fixtures/payout-fixtures.js";
import { PAYOUT_POLL_TIMEOUT_MS } from "../../src/config/timeouts.js";
import { ClaimSchema } from "../../src/services/claims/claims.schema.js";
import { PayoutSchema, PayoutStatusSchema } from "../../src/services/payouts/payouts.schema.js";
import {
  assertNoPayouts,
  assertPayoutCountUnchanged,
  assertPayoutStatusHeld,
  waitForAdditionalPayout,
  waitForAnyPayout,
  waitForPayoutStatusById,
  waitForTerminalPayout,
  waitForTerminalPayoutById,
} from "../../src/services/payouts/polling.js";

Given(
  "a claim exists in status {string} with a settled payout",
  async function (this: CustomWorld, status: string) {
    await createClaim(this, { amountCents: "60000" });
    await ensureClaimStatus(this, status);
    const payout = await waitForTerminalPayout(requireClaimId(this), this.payoutsClient);
    this.payouts = [payout];
    this.payoutId = payout.id;
  },
);

Given(
  "a claim exists in status {string} with a pending payout",
  async function (this: CustomWorld, status: string) {
    await createClaim(this, { amountCents: "60000" });
    await ensureClaimStatus(this, status);
    await waitForPendingPayouts(this);
  },
);

Given(
  "a claim exists in status {string} with amount {string} cents with a settled payout",
  async function (this: CustomWorld, status: string, amountCents: string) {
    await createClaim(this, { amountCents });
    await ensureClaimStatus(this, status);
    const payout = await waitForTerminalPayout(requireClaimId(this), this.payoutsClient);
    this.payouts = [payout];
    this.payoutId = payout.id;
  },
);

Given(
  "a claim exists in status {string} with amount {string} cents with a pending payout",
  async function (this: CustomWorld, status: string, amountCents: string) {
    await createClaim(this, { amountCents });
    await ensureClaimStatus(this, status);
    await waitForPendingPayouts(this);
  },
);

Then("the status update is accepted immediately", async function (this: CustomWorld) {
  expect(requireResponse(this).status, "approval returns 200 before the payout settles").to.equal(
    200,
  );
});

Then("the approval response does not contain the payout", async function (this: CustomWorld) {
  const response = requireResponse(this);
  const claim = ClaimSchema.parse(response.data);
  expect(claim.id, "approval returns this claim").to.equal(requireClaimId(this));
  expect(response.data, "approval response has no payout list").to.not.have.property("payouts");
  expect(response.data, "approval response has no nested payout").to.not.have.property("payout");
  expect(response.data, "approval response has no failure reason").to.not.have.property(
    "failureReason",
  );
});

Then("a payout should be generated for this claim", async function (this: CustomWorld) {
  const payouts = await waitForAnyPayout(
    requireClaimId(this),
    this.payoutsClient,
    PAYOUT_POLL_TIMEOUT_MS,
  );
  expect(payouts, "one payout per approval").to.have.length(1);
  rememberPayouts(this, payouts);
});

Then(
  "the payout should reach a terminal state within {int} seconds",
  async function (this: CustomWorld, seconds: number) {
    const payout = await waitForTerminalPayout(
      requireClaimId(this),
      this.payoutsClient,
      seconds * 1000,
    );
    this.payouts = [payout];
    this.payoutId = payout.id;
  },
);

Then("the payout status should be {string}", async function (this: CustomWorld, status: string) {
  const payout = requireLatestPayout(this);
  expect(payout.status, `payout status is ${status}`).to.equal(status);
});

Then(
  "the payout amount should be exactly {string} cents \\(amount minus {int} deductible\\)",
  async function (this: CustomWorld, amountCents: string, deductible: number) {
    const payout = requireLatestPayout(this);
    expect(
      payout.amountCents,
      `payout amount is the claim amount minus ${deductible} cents deductible`,
    ).to.equal(amountCents);
  },
);

Then(
  "no payout should be created for this claim within {int} seconds",
  async function (this: CustomWorld, seconds: number) {
    await assertNoPayouts(requireClaimId(this), this.payoutsClient, seconds * 1000);
    this.payouts = [];
    this.payoutId = null;
  },
);

Then(
  "no additional payout should be created for this claim within {int} seconds",
  async function (this: CustomWorld, seconds: number) {
    const previousCount = this.payouts.length;
    const payouts = await assertPayoutCountUnchanged(
      requireClaimId(this),
      this.payoutsClient,
      previousCount,
      seconds * 1000,
    );
    rememberPayouts(this, payouts);
  },
);

Then("one new payout should be generated for this claim", async function (this: CustomWorld) {
  const knownIds = this.payouts.map(function (payout) {
    return payout.id;
  });
  const payouts = await waitForAdditionalPayout(requireClaimId(this), this.payoutsClient, knownIds);
  const created = payouts.filter(function (payout) {
    return !knownIds.includes(payout.id);
  });
  expect(payouts, "a later approval adds one payout").to.have.length(knownIds.length + 1);
  expect(created, "the new payout is a different record").to.have.length(1);
  const fresh = created[0];
  if (!fresh) {
    throw new Error("No new payout in world");
  }
  this.payouts = [fresh];
  this.payoutId = fresh.id;
});

Then(
  "the new payout should reach a terminal state within {int} seconds",
  async function (this: CustomWorld, seconds: number) {
    const payout = await waitForTerminalPayoutById(
      requireLatestPayout(this).id,
      this.payoutsClient,
      seconds * 1000,
    );
    this.payouts = [payout];
    this.payoutId = payout.id;
  },
);

Then("the payout has no failure reason", async function (this: CustomWorld) {
  const payout = requireLatestPayout(this);
  expect(payout.failureReason, "a paid payout has no failure reason").to.equal("");
});

Then("the payout belongs to this claim", async function (this: CustomWorld) {
  const payout = requireLatestPayout(this);
  expect(payout.claimId, "payout is for this claim").to.equal(requireClaimId(this));
});

Then("the payout can be fetched on its own", async function (this: CustomWorld) {
  const known = requireLatestPayout(this);
  this.response = await this.payoutsClient.getPayout(known.id);
  const response = requireResponse(this);
  expect(response.status, "payout can be read by id").to.equal(200);
  const payout = PayoutSchema.parse(response.data);
  expect(payout.id, "fetched payout keeps its id").to.equal(known.id);
  expect(payout.claimId, "fetched payout stays on this claim").to.equal(requireClaimId(this));
  expect(payout.amountCents, "fetched payout keeps the settled amount").to.equal(known.amountCents);
  expect(payout.status, "fetched payout keeps the settled status").to.equal(known.status);
  this.payouts = [payout];
  this.payoutId = payout.id;
});

When("a payout is requested with an unknown id", async function (this: CustomWorld) {
  this.response = await this.payoutsClient.getPayout("payout-does-not-exist");
});

When("payouts are requested for an unknown claim", async function (this: CustomWorld) {
  this.response = await this.payoutsClient.getClaimPayouts("claim-does-not-exist");
});

Then("the payout request should be rejected as not found", async function (this: CustomWorld) {
  expect(requireResponse(this).status, "unknown payout resource is not found").to.equal(404);
});

Then(
  "the payout failureReason should be {string}",
  async function (this: CustomWorld, reason: string) {
    const payout = requireLatestPayout(this);
    expect(payout.failureReason, "high-value payout records the manual-review reason").to.equal(
      reason,
    );
  },
);

Then(
  "the payout status should transition to {string}",
  async function (this: CustomWorld, status: string) {
    const expected = PayoutStatusSchema.parse(status);
    const payout = this.payoutId
      ? await waitForPayoutStatusById(this.payoutId, this.payoutsClient, expected)
      : await waitForTerminalPayout(
          requireClaimId(this),
          this.payoutsClient,
          PAYOUT_POLL_TIMEOUT_MS,
          1_000,
          expected,
        );
    this.payouts = [payout];
    this.payoutId = payout.id;
    expect(payout.status, `payout status becomes ${status}`).to.equal(status);
  },
);

Then(
  "the payout status should stay {string} for {int} seconds",
  async function (this: CustomWorld, status: string, seconds: number) {
    const expected = PayoutStatusSchema.parse(status);
    const payoutId = this.payoutId ?? requireLatestPayout(this).id;
    const payout = await assertPayoutStatusHeld(
      payoutId,
      this.payoutsClient,
      expected,
      seconds * 1000,
    );
    this.payouts = [payout];
    this.payoutId = payout.id;
  },
);