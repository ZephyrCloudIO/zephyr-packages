import type { BundlerConfig } from '../types.js';

export const parcelConfig: BundlerConfig = {
  files: ['.parcelrc', '.parcelrc.json'],
  plugin: 'parcel-reporter-zephyr',
  importName: null, // Parcel uses JSON config
  strategy: 'run-all',
  operations: ['parcel-reporters'],
};
