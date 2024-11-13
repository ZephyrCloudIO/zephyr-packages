/**
 * Checks that obj has a deeply nested property with value usage:
 * `objHasKeys(federationRemoteEntry, ["origins", "0", "loc"])`
 *
 * @param obj
 * @param pathArr
 */
export function objHasKeys<T extends Record<string, T[keyof T] | T>>(
  obj: T,
  pathArr: string[]
): boolean {
  let _obj = obj;
  for (let i = 0; i < pathArr.length; i++) {
    if (!_obj || !Object.prototype.hasOwnProperty.call(_obj, pathArr[i])) {
      return false;
    }
    _obj = _obj[pathArr[i]] as T;
  }
  return true;
}
