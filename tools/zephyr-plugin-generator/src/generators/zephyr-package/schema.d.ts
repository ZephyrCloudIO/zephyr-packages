export interface ZephyrPackageGeneratorSchema {
  name: string;
  directory?: string;
  packageType?: 'plugin' | 'agent' | 'internal' | 'utility';
  bundler?:
    | 'webpack'
    | 'vite'
    | 'rollup'
    | 'rspack'
    | 'parcel'
    | 'metro'
    | 'modernjs'
    | 'rolldown'
    | 'rsbuild';
  description?: string;
  addTests?: boolean;
}
