import type { AxiosInstance, AxiosResponse } from "axios";

import type { CreateClaim, UpdateClaim } from "./claims.schema.js";

export class ClaimsClient {
  constructor(private readonly http: AxiosInstance) {}

  createClaim(data: CreateClaim): Promise<AxiosResponse<unknown>> {
    return this.http.post("/v1/claims", data);
  }

  postIncompleteClaim(body: Record<string, string>): Promise<AxiosResponse<unknown>> {
    return this.http.post("/v1/claims", body);
  }

  updateClaim(id: string, data: UpdateClaim): Promise<AxiosResponse<unknown>> {
    return this.http.patch(`/v1/claims/${id}`, data);
  }

  patchUnknownStatus(id: string, status: string): Promise<AxiosResponse<unknown>> {
    return this.http.patch(`/v1/claims/${id}`, { status });
  }

  getClaim(id: string): Promise<AxiosResponse<unknown>> {
    return this.http.get(`/v1/claims/${id}`);
  }

  deleteClaim(id: string): Promise<AxiosResponse<unknown>> {
    return this.http.delete(`/v1/claims/${id}`);
  }

  listClaims(params?: {
    pageSize?: number;
    pageToken?: string;
    statusFilter?: string;
  }): Promise<AxiosResponse<unknown>> {
    return this.http.get("/v1/claims", { params });
  }
}
