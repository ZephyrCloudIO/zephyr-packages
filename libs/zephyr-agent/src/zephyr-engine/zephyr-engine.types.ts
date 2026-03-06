export type ZephyrEngineBuilderTypes =
  | 'webpack'
  | 'rspack'
  | 'repack'
  | 'metro'
  | 'vite'
  | 'rollup'
  | 'parcel'
  | 'astro'
  | 'unknown';

export interface ZephyrEngineOptions {
  context: string | undefined;
  builder: ZephyrEngineBuilderTypes;
}
