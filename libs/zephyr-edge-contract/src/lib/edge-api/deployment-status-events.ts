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

export interface DeploymentStatusEventPayload {
  applicationVersionId: string;
  status: DeploymentStreamStatus;
  statusMessage?: string | null;
  terminal: boolean;
  source?: string;
  debug?: unknown;
}
