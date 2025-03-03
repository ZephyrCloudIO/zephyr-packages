import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  ZephyrSSRStore, 
  RemoteEvent, 
  FederationContext, 
  SharedContextData,
  HydratableComponentState
} from './types';

// Create a default empty store
const defaultStore: ZephyrSSRStore = {
  remotes: {},
  sharedContext: {},
  meta: {
    renderedAt: new Date().toISOString(),
    remoteVersions: {},
    renderMode: 'csr'
  }
};

// Create the context
const FederationStoreContext = createContext<FederationContext | null>(null);

// Create a provider component
export const FederationProvider: React.FC<{
  initialStore?: ZephyrSSRStore;
  children: React.ReactNode;
}> = ({ initialStore, children }) => {
  // Initialize state from window.__ZEPHYR_SSR_STORE if available, or from props, or default
  const [store, setStore] = useState<ZephyrSSRStore>(() => {
    if (typeof window !== 'undefined' && (window as any).__ZEPHYR_SSR_STORE) {
      return (window as any).__ZEPHYR_SSR_STORE;
    }
    return initialStore || defaultStore;
  });

  // Event listeners for cross-remote communication
  const [eventListeners] = useState<((event: RemoteEvent) => void)[]>([]);
  
  // Update window.__ZEPHYR_SSR_STORE when the store changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__ZEPHYR_SSR_STORE = store;
    }
  }, [store]);
  
  // State update methods
  const getRemoteState = (remoteName: string, componentId: string): HydratableComponentState | undefined => {
    return store.remotes[remoteName]?.[componentId];
  };
  
  const updateRemoteState = (
    remoteName: string, 
    componentId: string, 
    state: Partial<HydratableComponentState>
  ) => {
    setStore(prevStore => {
      // Create a new store object to ensure reference changes trigger renders
      const newStore = { ...prevStore };
      
      // Ensure the remotes object exists
      if (!newStore.remotes) {
        newStore.remotes = {};
      }
      
      // Ensure the remote object exists
      if (!newStore.remotes[remoteName]) {
        newStore.remotes[remoteName] = {};
      }
      
      // Update the component state
      newStore.remotes[remoteName][componentId] = {
        ...(newStore.remotes[remoteName][componentId] || { id: componentId, hydrated: false }),
        ...state,
      };
      
      return newStore;
    });
  };
  
  const getSharedContext = (): SharedContextData => {
    return store.sharedContext || {};
  };
  
  const updateSharedContext = (updates: Partial<SharedContextData>) => {
    setStore(prevStore => ({
      ...prevStore,
      sharedContext: {
        ...(prevStore.sharedContext || {}),
        ...updates
      }
    }));
    
    // Dispatch an event to notify other components about the context change
    dispatch({
      type: 'SHARED_CONTEXT_UPDATED',
      source: 'federation-provider',
      payload: updates,
      timestamp: Date.now()
    });
  };
  
  // Event dispatch system
  const dispatch = (event: RemoteEvent) => {
    // Notify all listeners
    eventListeners.forEach(listener => listener(event));
    
    // Handle system events
    if (event.type === 'REGISTER_REMOTE') {
      const { name, version } = event.payload;
      setStore(prevStore => ({
        ...prevStore,
        meta: {
          ...prevStore.meta,
          remoteVersions: {
            ...prevStore.meta.remoteVersions,
            [name]: version
          }
        }
      }));
    }
  };
  
  // Create context value
  const contextValue: FederationContext = {
    store,
    dispatch,
    getRemoteState,
    updateRemoteState,
    getSharedContext,
    updateSharedContext
  };
  
  return (
    <FederationStoreContext.Provider value={contextValue}>
      {children}
    </FederationStoreContext.Provider>
  );
};

// Create a hook for accessing the context
export const useFederation = (): FederationContext => {
  const context = useContext(FederationStoreContext);
  if (!context) {
    throw new Error('useFederation must be used within a FederationProvider');
  }
  return context;
};

// Create a hook for a specific remote component
export const useRemoteComponent = (
  remoteName: string,
  componentId: string,
  initialState: Partial<HydratableComponentState> = {}
): [HydratableComponentState, (updates: Partial<HydratableComponentState>) => void] => {
  const { getRemoteState, updateRemoteState } = useFederation();
  
  // Initialize state if it doesn't exist
  useEffect(() => {
    const currentState = getRemoteState(remoteName, componentId);
    if (!currentState) {
      updateRemoteState(remoteName, componentId, {
        id: componentId,
        hydrated: true,
        ...initialState
      });
    } else if (!currentState.hydrated) {
      // Mark as hydrated if it exists but hasn't been hydrated yet
      updateRemoteState(remoteName, componentId, {
        hydrated: true
      });
    }
  }, [remoteName, componentId, initialState, getRemoteState, updateRemoteState]);
  
  // Get the current state
  const state = getRemoteState(remoteName, componentId) || {
    id: componentId,
    hydrated: false,
    ...initialState
  };
  
  // Create an update function
  const setState = (updates: Partial<HydratableComponentState>) => {
    updateRemoteState(remoteName, componentId, updates);
  };
  
  return [state, setState];
};

// Create a hook for the shared context
export const useSharedContext = (): [SharedContextData, (updates: Partial<SharedContextData>) => void] => {
  const { getSharedContext, updateSharedContext } = useFederation();
  return [getSharedContext(), updateSharedContext];
};