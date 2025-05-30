export interface ZeDependency {
  version: string;
  registry?: string;
  app_uid?: string;
}

export interface ZeXPlatformDependency {
  [target: string]: ZeDependency;
}

export enum BuildTarget {
  ANDROID = 'android',
  IOS = 'ios',
  WEB = 'web',
}

export interface ZePackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;

  /** Zephyr:dependencies in package.json */
  ['zephyr:dependencies']?: Record<string, string | Record<BuildTarget, string>>;
  // parsed zephyr:dependencies
  zephyrDependencies?: Record<string, ZeDependency>;
  /** OptionalDependencies in package.json */
  optionalDependencies?: Record<string, string>;
  /** PeerDependencies in package.json */
  peerDependencies?: Record<string, string>;
  /** DevDependencies in package.json */
  devDependencies?: Record<string, string>;
  /** What does this default means and what it indicates? */
}
