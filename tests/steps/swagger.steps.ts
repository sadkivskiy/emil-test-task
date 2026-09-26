import { When, Then } from "@cucumber/cucumber";
import { expect } from "chai";

import type { CustomWorld } from "../support/world.js";
import { requireResponse } from "../support/require-response.js";
import {
  declaresBearer,
  OpenApiDocumentSchema,
} from "../../src/services/openapi/openapi.schema.js";

When("the OpenAPI specification is requested", async function (this: CustomWorld) {
  this.response = await this.openapi.getSwaggerDoc();
});

Then(
  "the OpenAPI specification should declare Bearer authentication",
  async function (this: CustomWorld) {
    const response = requireResponse(this);
    expect(response.status, "OpenAPI document is published").to.be.lessThan(400);
    const document = OpenApiDocumentSchema.parse(response.data);
    expect(
      declaresBearer(document),
      "OpenAPI spec must declare Bearer so Swagger UI can Authorize",
    ).to.equal(true);
  },
);
