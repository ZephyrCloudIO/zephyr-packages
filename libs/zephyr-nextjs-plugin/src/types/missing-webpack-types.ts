import type { Compiler } from 'webpack';
import type { XPackConfiguration } from 'zephyr-xpack-internal';

export type WebpackConfiguration = XPackConfiguration<Compiler>;
