export interface GenerateZeTypesOptions {
  zephyrUrls?: string[];
  projectRoot?: string;
  packageRoot?: string;
  packageJsonPath?: string;
  usePackageJson?: boolean;
  token?: string;
  autoLogin?: boolean;
  remoteTypesFolder?: string;
  abortOnError?: boolean;
  debug?: boolean;
}

export interface GenerateZeTypesResult {
  remotes: Record<string, string>;
  typesFolder: string;
  manifestUrls: string[];
  packageJsonPath?: string;
}
