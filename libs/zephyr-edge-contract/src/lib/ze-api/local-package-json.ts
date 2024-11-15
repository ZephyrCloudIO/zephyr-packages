/**
 * Extracts and returns the license/licenses abbrevations from the respective fields.
 *
 * @param {Object} packageJson The package.json file content as object.
 * @returns {String}
 */

export interface LocalPackageJson {
  name: string;
  version: string;
  homepage?: string;
  size?: number;
  license?: { type: string } | string;
  licenses?: Array<{ type: string }> | { type: string } | string;

  [key: string]: LocalPackageJson[keyof LocalPackageJson];
}
