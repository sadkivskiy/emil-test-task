import type { AxiosInstance, AxiosResponse } from "axios";

export class OpenApiClient {
  constructor(private readonly http: AxiosInstance) {}

  getSwaggerDoc(): Promise<AxiosResponse<unknown>> {
    return this.http.get("/swagger/spec.json");
  }
}
