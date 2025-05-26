import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'rspack_nx_mf_host',
  /**
   * To use a remote that does not exist in your current Nx Workspace You can use the
   * tuple-syntax to define your remote
   *
   * Remotes: [['my-external-remote', 'https://nx-angular-remote.netlify.app']]
   *
   * You _may_ need to add a `remotes.d.ts` file to your `src/` folder declaring the
   * external remote for tsc, with the following content:
   *
   * Declare module 'my-external-remote';
   */
  remotes: ['rspack_nx_mf_remote'],
};

/**
 * Nx requires a default export of the config to allow correct resolution of the module
 * federation graph.
 */
export default config;
