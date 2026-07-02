export interface ZeAppVersion {
  application_uid: string;
  snapshot_id: string;
  version: string;
  version_id: string;
  remote_entry_url: string;
  manifest_url?: string;
  remote_host: string;
  name: string;
  tag?: string;
  env?: string;
  createdAt: string;
  author: string;
}
export interface ZeAppVersionResponse extends ZeAppVersion {
  remotes?: ZeAppVersion[];
}
