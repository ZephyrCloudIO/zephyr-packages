import { XPackConfiguration } from 'zephyr-xpack-internal';
import { Configuration } from '@rspack/core';

/**
 * Rspack configuration type extended from XPackConfiguration This ensures compatibility
 * with the shared types
 */
export type RspackConfiguration = XPackConfiguration<Configuration>;
