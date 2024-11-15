import { safe_json_parse } from 'zephyr-edge-contract';
import { type ZePackageJson } from './ze-package-json.type';
import { getCache, saveCache } from '../node-persist/fs-cache';

const cache_prefix = 'package_json';

export async function getPackageJsonCache(
  startingPath: string
): Promise<ZePackageJson | undefined> {
  const cache_key = `${cache_prefix}:${startingPath}`;
  const cached = await getCache(cache_key);
  if (!cached) return;
  return safe_json_parse<ZePackageJson>(cached);
}

export async function setPackageJsonCache(
  startingPath: string,
  parsed_package_json: ZePackageJson
): Promise<void> {
  const cache_key = `${cache_prefix}:${startingPath}`;
  await saveCache(cache_key, JSON.stringify(parsed_package_json));
}
