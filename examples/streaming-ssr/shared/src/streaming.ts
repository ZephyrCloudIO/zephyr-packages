import { StreamingPriority, StreamingComponentConfig, Resource } from './types';

// Maps priority to order values for sorting
const PRIORITY_ORDER: Record<StreamingPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

/**
 * Creates a streaming resource configuration
 */
export function createStreamingConfig(
  config: Partial<StreamingComponentConfig> = {}
): StreamingComponentConfig {
  return {
    priority: config.priority ?? 'medium',
    deferTime: config.deferTime ?? getPriorityDeferTime(config.priority ?? 'medium'),
    visibilityThreshold: config.visibilityThreshold ?? 0.1,
    retry: config.retry ?? 3,
    timeout: config.timeout ?? 10000,
    cacheKey: config.cacheKey,
    cacheTime: config.cacheTime ?? 60000 // 1 minute default cache
  };
}

/**
 * Returns default defer time based on priority
 */
export function getPriorityDeferTime(priority: StreamingPriority): number {
  switch (priority) {
    case 'critical': return 0; // Load immediately
    case 'high': return 100; // 100ms
    case 'medium': return 500; // 500ms
    case 'low': return 2000; // 2 seconds
    default: return 500;
  }
}

/**
 * Sorts resources by priority for processing order
 */
export function sortResourcesByPriority<T>(resources: Resource<T>[]): Resource<T>[] {
  return [...resources].sort((a, b) => {
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });
}

/**
 * Creates a delay promise for deferred loading
 */
export function createDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Simulates a progressively loaded resource
 */
export async function simulateProgressiveLoad<T>(
  data: T, 
  config: { 
    totalTime: number,
    steps?: number,
    onProgress?: (progress: number) => void
  }
): Promise<T> {
  const steps = config.steps ?? 5;
  const stepTime = config.totalTime / steps;
  
  for (let i = 1; i <= steps; i++) {
    await createDelay(stepTime);
    if (config.onProgress) {
      config.onProgress((i / steps) * 100);
    }
  }
  
  return data;
}

/**
 * Creates a resource loader with retry capability
 */
export function createResourceLoader<T>(
  loadFn: () => Promise<T>,
  config: { 
    retry?: number, 
    retryDelay?: number 
  } = {}
): () => Promise<T> {
  const retries = config.retry ?? 3;
  const delay = config.retryDelay ?? 1000;
  
  return async function load(): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await loadFn();
      } catch (error) {
        lastError = error as Error;
        if (attempt < retries - 1) {
          await createDelay(delay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }
    
    throw lastError;
  };
}