import type { AxiosInstance, AxiosResponse } from "axios";

export class PayoutsClient {
  constructor(private readonly http: AxiosInstance) {}

  getClaimPayouts(claimId: string): Promise<AxiosResponse<unknown>> {
    return this.http.get(`/v1/claims/${claimId}/payouts`);
  }

  getPayout(id: string): Promise<AxiosResponse<unknown>> {
    return this.http.get(`/v1/payouts/${id}`);
  }
}
