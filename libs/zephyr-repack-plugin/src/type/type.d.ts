declare const __webpack_require__: {
  /** **webpack_require**.l is the loading script functionality in webpack */
  l: (url: string, fn: () => void, name: string, name2: string) => void;
  repack: {
    shared: {
      scriptManager: {
        resolvers: [string, number, ScriptLocatorResolver][];
        DEFAULT_RESOLVER_PRIORITY: number;
        addResolver:
          | ((
              resolver: ScriptLocatorResolver,
              options?: ResolverOptions
            ) => Promise<unknown>)
          | ((
              scriptId: string,
              caller?: string,
              referenceUrl?: string
            ) => { url: string } | undefined);
      };
    };
  };
};

type ScriptLocatorResolver = (
  scriptId?: string,
  caller?: string,
  referenceUrl?: string
) => Promise<{ url: string } | undefined>;

interface ResolverOptions {
  key: string;
}

// Reference: https://github.com/callstack/repack/blob/f8af03cd231c3d95a92099719d827e368f707b5c/packages/repack/src/modules/ScriptManager/types.ts#L144

/**
 * Defines a function to resolve a script locator used in {@link ScriptManagerConfig}. It's
 * an async function which should return an object with data on how {@link ScriptManager}
 * should fetch the script. All fields describing the script locator data are listed in
 * {@link ScriptLocator}.
 *
 * Return `undefined` if the script should be resolved by other resolvers instead.
 *
 * @param scriptId Id of the script to resolve.
 * @param caller Name of the calling script - it can be for example: name of the bundle,
 *   chunk or container.
 */
type ScriptLocatorResolver = (
  scriptId: string,
  caller?: string,
  referenceUrl?: string
) => Promise<ScriptLocator | undefined>;

/* Options for resolver when adding it to a `ScriptManager`. */
interface ResolverOptions {
  /**
   * Priority of the resolver. Defaults to `2`. Resolvers are called based on the highest
   * priority, so higher the number, the higher priority the resolver gets.
   */
  priority?: number;
  /**
   * Unique key to identify the resolver. If not provided, the resolver will be added
   * unconditionally. If provided, the new resolver will be replace the existing one
   * configured with the same `uniqueKey`.
   */
  key?: string;
}

/**
 * Interface for storage backend used in {@link ScriptManagerConfig}. The interface is
 * modelled on Async Storage from `react-native-community`.
 */
interface StorageApi {
  /** Gets the data for the key. */
  getItem: (key: string) => Promise<string | null | undefined>;
  /** Sets the item value based on the key. */
  setItem: (key: string, value: string) => Promise<void>;
  /** Removes the item based on the key. */
  removeItem: (key: string) => Promise<void>;
}
