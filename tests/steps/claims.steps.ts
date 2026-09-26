import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "chai";

import type { CustomWorld } from "../support/world.js";
import { requireResponse } from "../support/require-response.js";
import {
  ClaimSchema,
  ClaimStatusSchema,
  type CreateClaim,
} from "../../src/services/claims/claims.schema.js";
import {
  createClaim,
  ensureClaimStatus,
  omitClaimField,
  requireClaim,
  requireClaimId,
  trackClaimId,
  uniqueClaimantId,
} from "../fixtures/claims-fixtures.js";

function storeUpdate(world: CustomWorld): void {
  world.updateResponse = world.response;
}

function readId(data: unknown): unknown {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }
  return Object.fromEntries(Object.entries(data))["id"];
}

Given("a claim exists in status {string}", async function (this: CustomWorld, status: string) {
  await createClaim(this);
  await ensureClaimStatus(this, status);
});

Given(
  "a claim exists in status {string} with amount {string} cents",
  async function (this: CustomWorld, status: string, amountCents: string) {
    await createClaim(this, { amountCents });
    await ensureClaimStatus(this, status);
  },
);

When(
  "a new claim is submitted with title {string}, description {string}, amount {string} cents, and currency {string}",
  async function (
    this: CustomWorld,
    title: string,
    description: string,
    amountCents: string,
    currency: string,
  ) {
    this.response = await this.claims.createClaim({
      title,
      description,
      claimantId: uniqueClaimantId(),
      amountCents,
      currency,
    });
    trackClaimId(this, readId(this.response.data));
  },
);

When(
  "a new claim is submitted missing the {string} field",
  async function (this: CustomWorld, field: string) {
    const body: CreateClaim = {
      title: "Incomplete claim",
      description: "Missing required field",
      claimantId: uniqueClaimantId(),
      amountCents: "100000",
      currency: "EUR",
    };
    this.response = await this.claims.postIncompleteClaim(omitClaimField(body, field));
    trackClaimId(this, readId(this.response.data));
  },
);

When(
  "a new claim is submitted with an invalid amountCents value {string}",
  async function (this: CustomWorld, amountCents: string) {
    this.response = await this.claims.createClaim({
      title: "Invalid amount",
      description: "Protobuf leak probe",
      claimantId: uniqueClaimantId(),
      amountCents,
      currency: "EUR",
    });
    trackClaimId(this, readId(this.response.data));
  },
);

When(
  "a new claim is submitted with title {string} and description {string}",
  async function (this: CustomWorld, title: string, description: string) {
    this.response = await this.claims.createClaim({
      title,
      description,
      claimantId: uniqueClaimantId(),
      amountCents: "100000",
      currency: "EUR",
    });
    trackClaimId(this, readId(this.response.data));
  },
);

When("the claim status is updated to {string}", async function (this: CustomWorld, status: string) {
  this.response = await this.claims.updateClaim(requireClaimId(this), {
    status: ClaimStatusSchema.parse(status),
  });
  storeUpdate(this);
});

When(
  "the claim status is immediately updated to {string}",
  async function (this: CustomWorld, status: string) {
    this.response = await this.claims.updateClaim(requireClaimId(this), {
      status: ClaimStatusSchema.parse(status),
    });
    storeUpdate(this);
  },
);

When(
  "an attempt is made to update the status to {string}",
  async function (this: CustomWorld, status: string) {
    const id = requireClaimId(this);
    const parsed = ClaimStatusSchema.safeParse(status);
    this.response = parsed.success
      ? await this.claims.updateClaim(id, { status: parsed.data })
      : await this.claims.patchUnknownStatus(id, status);
    storeUpdate(this);
  },
);

When("the claim title is updated without changing the status", async function (this: CustomWorld) {
  this.response = await this.claims.updateClaim(requireClaimId(this), {
    title: `updated-title-${Date.now()}`,
  });
  storeUpdate(this);
});

When(
  "the claim description is updated without changing the status",
  async function (this: CustomWorld) {
    this.response = await this.claims.updateClaim(requireClaimId(this), {
      description: `updated-description-${Date.now()}`,
    });
    storeUpdate(this);
  },
);

When(
  "the claim title is updated to {string} and description to {string}",
  async function (this: CustomWorld, title: string, description: string) {
    this.response = await this.claims.updateClaim(requireClaimId(this), {
      title,
      description,
    });
    storeUpdate(this);
  },
);

When("the claim is deleted", async function (this: CustomWorld) {
  this.response = await this.claims.deleteClaim(requireClaimId(this));
});

When("the claim is fetched", async function (this: CustomWorld) {
  this.response = await this.claims.getClaim(requireClaimId(this));
});

When("the claim timestamps are recorded", async function (this: CustomWorld) {
  const claim = requireClaim(this);
  this.recordedCreatedAt = claim.createdAt;
  this.recordedUpdatedAt = claim.updatedAt;
});

When("{int} seconds pass", async function (this: CustomWorld, seconds: number) {
  await new Promise(function (resolve) {
    setTimeout(resolve, seconds * 1000);
  });
});

Then("the claim should be created successfully", async function (this: CustomWorld) {
  const response = requireResponse(this);
  expect(response.status, "create claim returns 200").to.equal(200);
  const claim = ClaimSchema.parse(response.data);
  expect(claim.id, "create claim returns an id").to.be.a("string").and.not.empty;
});

Then("the claim status should be {string}", async function (this: CustomWorld, status: string) {
  const claim = requireClaim(this);
  const patch =
    this.updateResponse === null ? null : ClaimSchema.safeParse(this.updateResponse.data);
  const detail =
    patch?.success === true
      ? `claim status is ${status}. Update response status was ${patch.data.status}`
      : `claim status is ${status}`;
  expect(claim.status, detail).to.equal(status);
});

Then("the claim title should be {string}", async function (this: CustomWorld, title: string) {
  const claim = requireClaim(this);
  expect(claim.title, `claim title is ${title}`).to.equal(title);
});

Then(
  "the claim description should be {string}",
  async function (this: CustomWorld, description: string) {
    const claim = requireClaim(this);
    expect(claim.description, `claim description is ${description}`).to.equal(description);
  },
);

Then("the claim status should not be {string}", async function (this: CustomWorld, status: string) {
  const claim = requireClaim(this);
  expect(claim.status, `claim status is not ${status}`).to.not.equal(status);
});

Then(
  "the claim status should be updated successfully to {string}",
  async function (this: CustomWorld, status: string) {
    const response = this.updateResponse;
    if (response === null) {
      throw new Error("No update response in world");
    }
    expect(response.status, "status update returns 200").to.equal(200);
    const claim = ClaimSchema.parse(response.data);
    expect(claim.status, `update response status is ${status}`).to.equal(status);
  },
);

Then(
  "the system should reject the request with a validation error",
  async function (this: CustomWorld) {
    expect(requireResponse(this).status, "invalid claim payload is rejected").to.be.oneOf([
      400, 422,
    ]);
  },
);

Then("the system should reject the transition request", async function (this: CustomWorld) {
  expect(requireResponse(this).status, "illegal status transition is rejected").to.be.oneOf([
    400, 409,
  ]);
});

Then(
  "the error message should not leak internal protobuf details",
  async function (this: CustomWorld) {
    const body = JSON.stringify(requireResponse(this).data);
    expect(body.toLowerCase(), "error body does not leak proto wire details").to.not.include(
      "proto:",
    );
    expect(body.toLowerCase(), "error body does not leak protobuf details").to.not.include(
      "protobuf",
    );
    expect(body.toLowerCase(), "error body does not leak int64 details").to.not.include("int64");
  },
);

Then(
  "the update response should include title {string} and description {string}",
  async function (this: CustomWorld, title: string, description: string) {
    const response = this.updateResponse;
    if (response === null) {
      throw new Error("No update response in world");
    }
    expect(response.status, "title update returns 200").to.equal(200);
    const claim = ClaimSchema.parse(response.data);
    expect(claim.title, "update response persists the title").to.equal(title);
    expect(claim.description, "update response persists the description").to.equal(description);
  },
);

Then(
  "the fetched claim should have title {string} and description {string}",
  async function (this: CustomWorld, title: string, description: string) {
    const response = requireResponse(this);
    expect(response.status, "fetch claim returns 200").to.equal(200);
    const claim = ClaimSchema.parse(response.data);
    const patch =
      this.updateResponse === null ? null : ClaimSchema.safeParse(this.updateResponse.data);
    const titleDetail =
      patch?.success === true
        ? `fetched claim persists the title. Update response title was ${patch.data.title}`
        : "fetched claim persists the title";
    const descriptionDetail =
      patch?.success === true
        ? `fetched claim persists the description. Update response description was ${patch.data.description}`
        : "fetched claim persists the description";
    expect(claim.title, titleDetail).to.equal(title);
    expect(claim.description, descriptionDetail).to.equal(description);
  },
);

Then("the claim updatedAt should be later than createdAt", async function (this: CustomWorld) {
  const claim = requireClaim(this);
  const createdAt = this.recordedCreatedAt;
  const previousUpdatedAt = this.recordedUpdatedAt;
  if (!createdAt || !previousUpdatedAt) {
    throw new Error("Claim timestamps were not recorded");
  }
  expect(
    new Date(claim.updatedAt).getTime(),
    "updatedAt is later than createdAt",
  ).to.be.greaterThan(new Date(createdAt).getTime());
  expect(
    new Date(claim.updatedAt).getTime(),
    "updatedAt is later than the timestamp recorded before the patch",
  ).to.be.greaterThan(new Date(previousUpdatedAt).getTime());
});

Then("deleting the claim should succeed", async function (this: CustomWorld) {
  expect(requireResponse(this).status, "delete claim returns 200").to.equal(200);
});

Then("the claim should no longer exist", async function (this: CustomWorld) {
  this.response = await this.claims.getClaim(requireClaimId(this));
  expect(requireResponse(this).status, "deleted claim is not found").to.equal(404);
});
