import type { ZephyrConfig } from 'zephyr-agent';

/** `embedRemotes` in zephyr.config.*: embed the resolved remotes in production app builds. */
export type EmbedRemotesConfig =
  | boolean
  | {
      /** Remote names (as declared by the host) that are not embedded. */
      exclude?: string[];
    };

/** Zephyr.config.* fields accepted by the React Native integrations (Metro, Re.Pack). */
export interface ZephyrNativeConfig extends ZephyrConfig {
  /**
   * Production builds download every declared remote, as resolved for the build target,
   * and ship it inside the app as the offline last resort. Metro apps also need
   * zephyr-native-cache; Re.Pack apps need @callstack/repack 5.1+.
   */
  embedRemotes?: EmbedRemotesConfig;
}
