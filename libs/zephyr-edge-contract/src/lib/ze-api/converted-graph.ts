import { LocalPackageJson } from './local-package-json';

export interface ConvertedGraph {
  id?: string;
  version?: string;
  name?: string;
  remote: unknown;
  metadata: unknown;
  versionData: unknown;
  overrides: unknown[];
  consumes: unknown[];
  modules: unknown[];
  environment: unknown;
  posted: unknown;
  group: unknown;
  sha: unknown;
  buildHash: unknown;
  dependencies?: LocalPackageJson[];
  devDependencies?: LocalPackageJson[];
  optionalDependencies?: LocalPackageJson[];
}
