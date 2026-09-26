import { CUCUMBER_STEP_TIMEOUT_MS } from "./src/config/timeouts.ts";

const base = {
  import: ["tests/support/**/*.ts", "tests/steps/**/*.ts"],
  format: ["progress", "summary", "html:reports/cucumber.html"],
  publishQuiet: true,
  timeout: CUCUMBER_STEP_TIMEOUT_MS,
};

const paths = ["tests/features/**/*.feature"];

export default {
  ...base,
  paths,
};

export const lifecycle = {
  ...base,
  paths,
  tags: "@lifecycle",
};

export const payouts = {
  ...base,
  paths,
  tags: "@payout",
};

export const list = {
  ...base,
  paths,
  tags: "@list",
};

export const swagger = {
  ...base,
  paths,
  tags: "@swagger",
};
