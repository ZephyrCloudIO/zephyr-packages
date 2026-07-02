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
