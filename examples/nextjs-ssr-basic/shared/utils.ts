import { ZephyrSSRStore } from './types';

/**
 * Get the SSR store from window if available
 */
export const getSSRStore = (): ZephyrSSRStore | undefined => {
  if (typeof window !== 'undefined') {
    return (window as any).__ZEPHYR_SSR_STORE;
  }
  return undefined;
};

/**
 * Set the SSR store in window
 */
export const setSSRStore = (store: ZephyrSSRStore): void => {
  if (typeof window !== 'undefined') {
    (window as any).__ZEPHYR_SSR_STORE = store;
  }
};

/**
 * Get component state from the SSR store
 */
export const getComponentState = (remote: string, componentId: string) => {
  const store = getSSRStore();
  if (store && store[remote] && store[remote][componentId]) {
    return store[remote][componentId];
  }
  return undefined;
};

/**
 * Update component state in the SSR store
 */
export const updateComponentState = (remote: string, componentId: string, state: any) => {
  const store = getSSRStore() || {};
  
  if (!store[remote]) {
    store[remote] = {};
  }
  
  store[remote][componentId] = {
    ...store[remote][componentId],
    ...state
  };
  
  setSSRStore(store);
};

/**
 * Create a unique ID for a component instance
 */
export const createComponentId = (prefix: string): string => {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
};