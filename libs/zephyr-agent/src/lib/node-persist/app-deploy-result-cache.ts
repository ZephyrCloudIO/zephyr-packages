import nodePersist from 'node-persist';
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
  void (await nodePersist.setItem(`${StorageKeys.ze_app_deploy_result}:${application_uid}`, value, {
    ttl: 1000 * 60 * 60 * 24,
  }));
}

export async function getAppDeployResult(
  application_uid: string
): Promise<DeployResult | undefined> {
  await storage;
  return nodePersist.getItem(`${StorageKeys.ze_app_deploy_result}:${application_uid}`);
}

export async function removeAppDeployResult(application_uid: string): Promise<void> {
  await storage;
  await nodePersist.removeItem(`${StorageKeys.ze_app_deploy_result}:${application_uid}`);
}

export async function getAllDeployedApps(): Promise<string[]> {
  await storage;
  const allKeys: unknown = await nodePersist.keys();
  if (!Array.isArray(allKeys)) {
    return [];
  }
  const prefix = `${StorageKeys.ze_app_deploy_result}:`;
  const resultKeys = allKeys.filter(
    (key): key is string =>
      typeof key === 'string' && key.startsWith(prefix) && key.length > prefix.length
  );
  return resultKeys.map((key) => key.substring(prefix.length));
}

export async function getAllAppDeployResults(): Promise<Record<string, DeployResult>> {
  await storage;
  const results: Record<string, DeployResult> = {};
  const prefix = `${StorageKeys.ze_app_deploy_result}:`;

  await nodePersist.forEach((entry) => {
    if (
      typeof entry.key === 'string' &&
      entry.key.startsWith(prefix) &&
      entry.key.length > prefix.length
    ) {
      const application_uid = entry.key.substring(prefix.length);
      results[application_uid] = entry.value;
    }
  });

  return results;
}
