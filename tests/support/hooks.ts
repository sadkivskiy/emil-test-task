import { After } from "@cucumber/cucumber";

import type { CustomWorld } from "./world.js";

After(async function (this: CustomWorld) {
  const ids = this.createdClaimIds.slice();
  for (const id of ids) {
    try {
      const response = await this.claims.deleteClaim(id);
      // 404 means the scenario already deleted the claim.
      if (response.status >= 400 && response.status !== 404) {
        console.warn(`Cleanup delete failed for claim ${id}. HTTP ${response.status}`);
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : "unknown error";
      console.warn(`Cleanup delete failed for claim ${id}. ${detail}`);
    }
  }
});
