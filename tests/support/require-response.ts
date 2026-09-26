import type { AxiosResponse } from "axios";

import type { CustomWorld } from "./world.js";

export function requireResponse(world: CustomWorld): AxiosResponse<unknown> {
  if (world.response === null) {
    throw new Error("No response in world");
  }
  return world.response;
}
