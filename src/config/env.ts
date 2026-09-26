import { config as loadEnv } from "dotenv";
import { z } from "zod";

const EnvSchema = z.object({
  CLAIM_SERVICE_API_URL: z.string().url(),
  CLAIM_SERVICE_API_TOKEN: z.string().min(1),
});

export type ClaimServiceConfig = z.infer<typeof EnvSchema>;

let cached: ClaimServiceConfig | undefined;

/** Throws before the first request when a required variable is missing or blank. */
export function loadConfig(): ClaimServiceConfig {
  if (cached) {
    return cached;
  }
  loadEnv();
  cached = EnvSchema.parse(process.env);
  return cached;
}
