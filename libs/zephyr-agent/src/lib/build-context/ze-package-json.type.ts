export interface ZePackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;

  // to satisfy build stats
  /** OptionalDependencies in package.json */
  optionalDependencies?: Record<string, string>;
  /** PeerDependencies in package.json */
  peerDependencies?: Record<string, string>;
  /** DevDependencies in package.json */
  devDependencies?: Record<string, string>;
  /** What does this default means and what it indicates? */
}
