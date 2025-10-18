import type { BundlerConfig } from '../types.js';

export const parcelConfig: BundlerConfig = {
  files: ['.parcelrc', '.parcelrc.json'],
  plugin: 'parcel-reporter-zephyr',
  importName: null, // Parcel uses JSON config
  patterns: [
    {
      type: 'parcel-reporters',
      matcher: /"reporters"\s*:\s*\[/,
      transform: 'addToParcelReporters',
    },
  ],
};
