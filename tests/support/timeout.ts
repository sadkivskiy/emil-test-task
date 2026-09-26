import { setDefaultTimeout } from "@cucumber/cucumber";

import { CUCUMBER_STEP_TIMEOUT_MS } from "../../src/config/timeouts.js";

setDefaultTimeout(CUCUMBER_STEP_TIMEOUT_MS);
