import { Given } from "@cucumber/cucumber";
import { expect } from "chai";

import type { CustomWorld } from "../support/world.js";

Given("the API is authenticated", async function (this: CustomWorld) {
  expect(this.config.CLAIM_SERVICE_API_URL, "CLAIM_SERVICE_API_URL is loaded").to.match(
    /^https?:\/\//,
  );
  expect(
    this.config.CLAIM_SERVICE_API_TOKEN.length,
    "CLAIM_SERVICE_API_TOKEN is loaded",
  ).to.be.greaterThan(0);
});
