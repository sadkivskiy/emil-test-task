import axios, { type AxiosInstance } from "axios";

import type { ClaimServiceConfig } from "../config/env.js";

export function createHttpClient(config: ClaimServiceConfig): AxiosInstance {
  const http = axios.create({
    baseURL: config.CLAIM_SERVICE_API_URL,
    validateStatus: () => true,
    headers: {
      "Content-Type": "application/json",
    },
  });

  http.interceptors.request.use((requestConfig) => {
    requestConfig.headers.Authorization = `Bearer ${config.CLAIM_SERVICE_API_TOKEN}`;
    return requestConfig;
  });

  return http;
}
