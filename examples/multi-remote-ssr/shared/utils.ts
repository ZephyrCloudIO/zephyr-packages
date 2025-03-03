import { HydratableComponentState, ZephyrSSRStore, RemoteEvent } from './types';

/**
 * Creates a unique ID for a component
 */
export const createComponentId = (prefix: string): string => {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Gets the SSR store from the window object
 */
export const getSSRStore = (): ZephyrSSRStore | undefined => {
  if (typeof window !== 'undefined') {
    return (window as any).__ZEPHYR_SSR_STORE;
  }
  return undefined;
};

/**
 * Sets the SSR store in the window object
 */
export const setSSRStore = (store: ZephyrSSRStore): void => {
  if (typeof window !== 'undefined') {
    (window as any).__ZEPHYR_SSR_STORE = store;
  }
};

/**
 * Creates a default SSR store
 */
export const createDefaultStore = (renderMode: 'ssr' | 'csr' = 'csr'): ZephyrSSRStore => {
  return {
    remotes: {},
    sharedContext: {},
    meta: {
      renderedAt: new Date().toISOString(),
      remoteVersions: {},
      renderMode
    }
  };
};

/**
 * Creates a RemoteEvent object
 */
export const createRemoteEvent = (
  type: string,
  source: string,
  payload: any,
  target?: string
): RemoteEvent => {
  return {
    type,
    source,
    target,
    payload,
    timestamp: Date.now()
  };
};

/**
 * Merges two SSR stores, with the second taking precedence
 */
export const mergeSSRStores = (
  store1: ZephyrSSRStore,
  store2: ZephyrSSRStore
): ZephyrSSRStore => {
  // Start with a copy of the first store
  const result: ZephyrSSRStore = JSON.parse(JSON.stringify(store1));
  
  // Merge remotes
  if (store2.remotes) {
    result.remotes = result.remotes || {};
    
    // For each remote in store2
    Object.entries(store2.remotes).forEach(([remoteName, remoteData]) => {
      result.remotes[remoteName] = result.remotes[remoteName] || {};
      
      // For each component in the remote
      Object.entries(remoteData).forEach(([componentId, componentState]) => {
        result.remotes[remoteName][componentId] = {
          ...(result.remotes[remoteName][componentId] || {}),
          ...componentState
        };
      });
    });
  }
  
  // Merge shared context
  if (store2.sharedContext) {
    result.sharedContext = {
      ...(result.sharedContext || {}),
      ...store2.sharedContext
    };
  }
  
  // Merge metadata
  if (store2.meta) {
    result.meta = {
      ...(result.meta || {
        renderedAt: new Date().toISOString(),
        remoteVersions: {},
        renderMode: 'csr'
      }),
      ...store2.meta,
      // Merge remote versions specifically
      remoteVersions: {
        ...(result.meta?.remoteVersions || {}),
        ...(store2.meta.remoteVersions || {})
      }
    };
  }
  
  return result;
};

/**
 * Serializes an SSR store to a string
 */
export const serializeSSRStore = (store: ZephyrSSRStore): string => {
  return JSON.stringify(store);
};

/**
 * Deserializes an SSR store from a string
 */
export const deserializeSSRStore = (serialized: string): ZephyrSSRStore => {
  try {
    return JSON.parse(serialized);
  } catch (e) {
    console.error('Failed to deserialize SSR store:', e);
    return createDefaultStore();
  }
};

/**
 * Creates a script tag containing the serialized SSR store
 */
export const createSSRStoreScript = (store: ZephyrSSRStore): string => {
  return `
    <script id="__ZEPHYR_SSR_STORE_SCRIPT__" type="application/json">
      ${serializeSSRStore(store)}
    </script>
    <script>
      (function() {
        try {
          const storeData = document.getElementById('__ZEPHYR_SSR_STORE_SCRIPT__');
          if (storeData) {
            window.__ZEPHYR_SSR_STORE = JSON.parse(storeData.textContent || '{}');
          }
        } catch (e) {
          console.error('Failed to parse SSR store data:', e);
          window.__ZEPHYR_SSR_STORE = ${serializeSSRStore(createDefaultStore('csr'))};
        }
      })();
    </script>
  `;
};