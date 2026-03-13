export interface BuildStatsAcceptedResponse {
  status: 'accepted';
  buildId: string;
}

export interface BuildStatsOkResponse {
  status: 'ok';
  buildId: string;
}

export type BuildStatsResponse = BuildStatsAcceptedResponse | BuildStatsOkResponse;
