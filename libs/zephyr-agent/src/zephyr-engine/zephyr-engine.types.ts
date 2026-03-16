export type ZephyrEngineBuilderTypes =
  | 'webpack'
  | 'rspack'
  | 'repack'
  | 'metro'
  | 'vite'
  | 'nuxt'
  | 'rollup'
  | 'parcel'
  | 'astro'
  | 'unknown';

export interface ZephyrEngineOptions {
  context: string | undefined;
  builder: ZephyrEngineBuilderTypes;
}
