import { createHash } from 'node:crypto';
import {
  createZephyrRuntimeFile,
  DependenciesRecord,
  VariablesRecord,
} from 'zephyr-edge-contract';

export function createZephyrRuntimeAsset(
  variablesRecord: VariablesRecord | null,
  dependenciesRecord: DependenciesRecord | null
) {
  const source = ;

  return {
    source,
    hash: createHash('sha256').update(source).digest('base64url').slice(0, 8),
  };
}
