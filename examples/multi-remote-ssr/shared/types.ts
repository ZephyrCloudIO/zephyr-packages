/**
 * Defines component props that can be serialized for SSR
 */
export interface SerializableComponentProps {
  id: string;
  [key: string]: any;
}

/**
 * Defines component state that can be hydrated on the client
 */
export interface HydratableComponentState {
  id: string;
  hydrated: boolean;
  [key: string]: any;
}

/**
 * Defines the shared context data structure
 */
export interface SharedContextData {
  userId?: string;
  theme?: 'light' | 'dark';
  locale?: string;
  permissions?: string[];
  features?: Record<string, boolean>;
  preferences?: Record<string, any>;
  [key: string]: any;
}

/**
 * Defines the structure of SSR store data for a single remote
 */
export interface RemoteSSRStoreData {
  [componentId: string]: HydratableComponentState;
}

/**
 * Defines the structure of the entire SSR store
 */
export interface ZephyrSSRStore {
  // Data specific to each remote
  remotes: {
    [remoteName: string]: RemoteSSRStoreData;
  };
  // Global shared context
  sharedContext: SharedContextData;
  // Metadata about the rendering
  meta: {
    renderedAt: string;
    remoteVersions: Record<string, string>;
    renderMode: 'ssr' | 'csr';
  };
}

/**
 * Remote configuration specifics
 */
export interface RemoteConfig {
  name: string;
  url: string;
  version?: string;
  fallbacks?: string[];
  ssrEnabled: boolean;
}

/**
 * Defines events that can be sent between remotes
 */
export interface RemoteEvent {
  type: string;
  source: string;
  target?: string; // if undefined, broadcast to all
  payload: any;
  timestamp: number;
}

/**
 * Defines a federation context that can be shared across remotes
 */
export interface FederationContext {
  store: ZephyrSSRStore;
  dispatch: (event: RemoteEvent) => void;
  getRemoteState: (remoteName: string, componentId: string) => HydratableComponentState | undefined;
  updateRemoteState: (remoteName: string, componentId: string, state: Partial<HydratableComponentState>) => void;
  getSharedContext: () => SharedContextData;
  updateSharedContext: (updates: Partial<SharedContextData>) => void;
}