export const DeploymentRoomEvents = {
  joinDeploymentRoom: 'joinDeploymentRoom',
  leaveDeploymentRoom: 'leaveDeploymentRoom',
} as const;

export const DeploymentStatusEvents = {
  deploymentStatus: 'deployment-status',
} as const;

export type DeploymentStreamStatus =
  | 'waiting_for_version'
  | 'deploying'
  | 'queued_retry'
  | 'available'
  | 'failed';

/** Keeps producer names consistent across gateway, queue-worker, and cloud fanout. */
export type DeploymentStatusSource = 'gateway' | 'queue-worker' | 'manual' | 'cloud';

/** Tracks persisted app-version lifecycle states used by status-report writers. */
export type DeploymentStatusReportStatus = 'deploying' | 'available' | 'failed';

/** Report stream updates never send waiting_for_version because that is replay-only. */
export type DeploymentStatusReportStreamStatus = Exclude<
  DeploymentStreamStatus,
  'waiting_for_version'
>;

/** Shared payload for status-report endpoints invoked by deployment workers/gateway. */
export interface DeploymentStatusReportPayload {
  applicationVersionId: string;
  status: DeploymentStatusReportStatus;
  streamStatus?: DeploymentStatusReportStreamStatus;
  statusMessage?: string | null;
  source: Exclude<DeploymentStatusSource, 'cloud'>;
  summary?: string[];
  error?: unknown;
}

export interface DeploymentStatusEventPayload {
  applicationVersionId: string;
  status: DeploymentStreamStatus;
  statusMessage?: string | null;
  terminal: boolean;
  source?: DeploymentStatusSource;
  debug?: unknown;
}
