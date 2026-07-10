import type { AddressMode } from '../node-persist/upload-provider-options';

interface AddressingConfig {
  ADDRESS_MODE?: AddressMode;
  ENVIRONMENTS?: Record<string, { addressMode?: AddressMode }>;
}

/**
 * A single build can be published to the application's primary edge and to additional
 * environments. Relative/runtime-resolved assets are required when any target uses path
 * addressing; they remain valid for hostname-addressed targets.
 */
export function usesPathAddressing(config: AddressingConfig): boolean {
  return (
    config.ADDRESS_MODE === 'path' ||
    Object.values(config.ENVIRONMENTS ?? {}).some(
      (environment) => environment.addressMode === 'path'
    )
  );
}
