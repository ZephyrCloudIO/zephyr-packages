import { Compiler } from 'webpack';
import { XPackConfiguration } from 'zephyr-xpack-internal';

export type WebpackConfiguration = XPackConfiguration<Compiler>;
