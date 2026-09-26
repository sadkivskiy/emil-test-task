import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "chai";

import type { CustomWorld } from "../support/world.js";
import { requireResponse } from "../support/require-response.js";
import { ensureAtLeastClaims, requireClaimId } from "../fixtures/claims-fixtures.js";
import { ListClaimsResponseSchema } from "../../src/services/claims/claims.schema.js";

Given(
  "there are at least {int} claims in the system",
  async function (this: CustomWorld, minCount: number) {
    await ensureAtLeastClaims(this, minCount);
  },
);

When(
  "a request is made to list claims filtered by {string}",
  async function (this: CustomWorld, statusFilter: string) {
    this.response = await this.claims.listClaims({ statusFilter });
  },
);

When(
  "a request is made to list claims filtered by {string} with pageSize {int}",
  async function (this: CustomWorld, statusFilter: string, pageSize: number) {
    this.response = await this.claims.listClaims({ statusFilter, pageSize });
  },
);

When(
  "a request is made to list claims with pageSize {int}",
  async function (this: CustomWorld, pageSize: number) {
    this.response = await this.claims.listClaims({ pageSize });
  },
);

Then(
  "exactly {int} claims should be returned in the response array",
  async function (this: CustomWorld, count: number) {
    const body = ListClaimsResponseSchema.parse(requireResponse(this).data);
    expect(body.claims.length, "pageSize returns exactly the requested number of claims").to.equal(
      count,
    );
  },
);

Then(
  "all returned claims should have the status {string}",
  async function (this: CustomWorld, status: string) {
    const body = ListClaimsResponseSchema.parse(requireResponse(this).data);
    expect(body.claims, "status filter returns claims").to.not.be.empty;
    for (const claim of body.claims) {
      expect(claim.status, "every listed claim matches the status filter").to.equal(status);
    }
    const claimId = requireClaimId(this);
    expect(
      body.claims.map((claim) => claim.id),
      `filtered list includes claim ${claimId}`,
    ).to.include(claimId);
  },
);

Then(
  "the returned claims should include status {string}",
  async function (this: CustomWorld, status: string) {
    const body = ListClaimsResponseSchema.parse(requireResponse(this).data);
    const statuses = body.claims.map(function (claim) {
      return claim.status;
    });
    expect(statuses, `filtered list includes ${status}`).to.include(status);
  },
);

Then("a nextPageToken should be provided for the next page", async function (this: CustomWorld) {
  const body = ListClaimsResponseSchema.parse(requireResponse(this).data);
  expect(body.nextPageToken, "nextPageToken is present when more claims exist").to.be.a("string")
    .and.not.empty;
  this.listedClaimIds = body.claims.map(function (claim) {
    return claim.id;
  });
});

When(
  "the next page is requested with pageSize {int}",
  async function (this: CustomWorld, pageSize: number) {
    const body = ListClaimsResponseSchema.parse(requireResponse(this).data);
    const pageToken = body.nextPageToken;
    if (!pageToken) {
      throw new Error("No nextPageToken on the current page");
    }
    this.listedClaimIds = body.claims.map(function (claim) {
      return claim.id;
    });
    this.response = await this.claims.listClaims({ pageSize, pageToken });
  },
);

Then(
  "the next page should return claims that were not on the previous page",
  async function (this: CustomWorld) {
    const body = ListClaimsResponseSchema.parse(requireResponse(this).data);
    expect(body.claims, "next page returns claims").to.not.be.empty;
    const seen = new Set(this.listedClaimIds);
    const repeated = body.claims.filter(function (claim) {
      return seen.has(claim.id);
    });
    expect(
      repeated.map(function (claim) {
        return claim.id;
      }),
      "next page does not repeat claims from the previous page",
    ).to.deep.equal([]);
  },
);

Then(
  "the totalCount should be greater than {int}",
  async function (this: CustomWorld, min: number) {
    const body = ListClaimsResponseSchema.parse(requireResponse(this).data);
    expect(body.totalCount, "totalCount is greater than the scenario minimum").to.be.greaterThan(
      min,
    );
  },
);

Then("the claims array should not be empty", async function (this: CustomWorld) {
  const body = ListClaimsResponseSchema.parse(requireResponse(this).data);
  expect(body.claims, "list page is not empty").to.not.be.empty;
});

Then(
  "the totalCount should be at least the number of returned claims",
  async function (this: CustomWorld) {
    const body = ListClaimsResponseSchema.parse(requireResponse(this).data);
    expect(body.totalCount, "totalCount covers the returned page").to.be.at.least(
      body.claims.length,
    );
  },
);
