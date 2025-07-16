import { forEach, getItem, keys, removeItem, setItem } from 'node-persist';
import type { Snapshot } from 'zephyr-edge-contract';
import { storage } from './storage';
import { StorageKeys } from './storage-keys';

export interface DeployResult {
  urls: string[];
  snapshot: Snapshot;
}

export async function setAppDeployResult(
  application_uid: string,
  value: DeployResult
): Promise<void> {
  await storage;
  void (await setItem(`${StorageKeys.ze_app_deploy_result}:${application_uid}`, value, {
    ttl: 1000 * 60 * 60 * 24,
  }));
}

export async function getAppDeployResult(
  application_uid: string
): Promise<DeployResult | undefined> {
  await storage;
  return getItem(`${StorageKeys.ze_app_deploy_result}:${application_uid}`);
}

export async function removeAppDeployResult(application_uid: string): Promise<void> {
  await storage;
  await removeItem(`${StorageKeys.ze_app_deploy_result}:${application_uid}`);
}

export async function getAllDeployedApps(): Promise<string[]> {
  await storage;
  const allKeys = await keys();
  const resultKeys = allKeys.filter((key) =>
    key.startsWith(StorageKeys.ze_app_deploy_result)
  );
  return resultKeys.map((key) =>
    key.substring(StorageKeys.ze_app_deploy_result.length + 1)
  );
}

export async function getAllAppDeployResults(): Promise<Record<string, DeployResult>> {
  await storage;
  const results: Record<string, DeployResult> = {};

  await forEach((entry) => {
    if (entry.key && entry.key.startsWith(StorageKeys.ze_app_deploy_result)) {
      const application_uid = entry.key.substring(
        StorageKeys.ze_app_deploy_result.length + 1
      );
      results[application_uid] = entry.value;
    }
  });

  return results;
}
