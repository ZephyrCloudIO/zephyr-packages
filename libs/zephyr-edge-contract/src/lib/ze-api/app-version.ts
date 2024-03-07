export interface ZeAppVersionItem {
  // internal version
  id: string;
  // hostname
  url: string;
  // npm-like version
  version: string;
}

export interface ZeAppTagValue {
  version: string;
  author: string | undefined;
  createdAt: number;
}

export type ZeAppTags = Record<string, ZeAppTagValue>;

export interface ZeAppRemoteVersions {
  // internal version
  id: string;
  // remote app uid
  name: string;
  // todo: @valorkin should full url to remote entry
  // domain hostname where remote is deployed
  versions: ZeAppVersionItem[];
  tags: ZeAppTags;
  currentVersion: string;
}

// api: app_version response type
export interface ZeAppVersion {
  // internal version
  id: string;
  // app uid
  app: string;
  versions: ZeAppVersionItem[];
  // npm-like version
  version: string;
  // npm-like tags
  tags: ZeAppTags;
  // mf-config
  snapshot: {
    mfConfig: {
      // key is mf-config app name
      remotes: Record<string, ZeAppRemoteVersions | null>;
    };
  };
}
