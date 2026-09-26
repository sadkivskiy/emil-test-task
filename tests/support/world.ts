import { setWorldConstructor, World, type IWorldOptions } from "@cucumber/cucumber";
import type { AxiosInstance, AxiosResponse } from "axios";

import { loadConfig, type ClaimServiceConfig } from "../../src/config/env.js";
import { createHttpClient } from "../../src/http/create-http-client.js";
import { ClaimsClient } from "../../src/services/claims/claims-client.js";
import { OpenApiClient } from "../../src/services/openapi/openapi-client.js";
import { PayoutsClient } from "../../src/services/payouts/payouts-client.js";
import type { Payout } from "../../src/services/payouts/payouts.schema.js";

export class CustomWorld extends World {
  readonly config: ClaimServiceConfig;
  readonly http: AxiosInstance;
  readonly claims: ClaimsClient;
  readonly payoutsClient: PayoutsClient;
  readonly openapi: OpenApiClient;
  claimId: string | null;
  response: AxiosResponse<unknown> | null;
  updateResponse: AxiosResponse<unknown> | null;
  payouts: Payout[];
  payoutId: string | null;
  createdClaimIds: string[];
  listedClaimIds: string[];
  recordedCreatedAt: string | null;
  recordedUpdatedAt: string | null;

  constructor(options: IWorldOptions) {
    super(options);
    this.config = loadConfig();
    this.http = createHttpClient(this.config);
    this.claims = new ClaimsClient(this.http);
    this.payoutsClient = new PayoutsClient(this.http);
    this.openapi = new OpenApiClient(this.http);
    this.claimId = null;
    this.response = null;
    this.updateResponse = null;
    this.payouts = [];
    this.payoutId = null;
    this.createdClaimIds = [];
    this.listedClaimIds = [];
    this.recordedCreatedAt = null;
    this.recordedUpdatedAt = null;
  }
}

setWorldConstructor(CustomWorld);
