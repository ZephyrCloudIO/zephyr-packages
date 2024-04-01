export interface ZeAppVersion {
  application_uid: string;
  snapshot_id: string;
  // npm-like version
  version: string;

  remote_entry_url: string;
  remote_host: string;

  // application name
  name: string;
  // tag name
  tag?: string;
  // env name
  env?: string;

  createdAt: string;
  author: string;
}

// api: app_version response type
export interface ZeAppVersionResponse extends ZeAppVersion {
  // remote versions resolved at build time (versions) or read time (tags, envs)
  remotes?: ZeAppVersion[];
}
