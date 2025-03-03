/**
 * Bundle Size Analyzer
 * 
 * A utility for analyzing bundle sizes in SSR applications.
 * Measures impact of SSR on JavaScript bundle sizes and client-side hydration.
 */

export interface BundleInfo {
  /**
   * Name of the bundle file
   */
  name: string;
  
  /**
   * Size of the bundle in bytes
   */
  size: number;
  
  /**
   * Minified size in bytes (if available)
   */
  minifiedSize?: number;
  
  /**
   * Gzipped size in bytes (if available)
   */
  gzippedSize?: number;
  
  /**
   * Type of the bundle
   */
  type: 'initial' | 'async' | 'common' | 'vendor';
  
  /**
   * Whether the bundle is SSR-specific
   */
  isSSR: boolean;
  
  /**
   * Whether the bundle is used for hydration
   */
  isHydration?: boolean;
  
  /**
   * List of modules in the bundle
   */
  modules?: Array<{
    name: string;
    size: number;
    path?: string;
  }>;
}

export interface BundleSizeMetrics {
  /**
   * Total bundle size in bytes
   */
  totalSize: number;
  
  /**
   * Total minified size in bytes
   */
  totalMinifiedSize: number;
  
  /**
   * Total gzipped size in bytes
   */
  totalGzippedSize: number;
  
  /**
   * Client-side bundle metrics
   */
  client: {
    initialSize: number;
    asyncSize: number;
    hydrationSize: number;
    totalSize: number;
  };
  
  /**
   * Server-side bundle metrics
   */
  server: {
    initialSize: number;
    asyncSize: number;
    totalSize: number;
  };
  
  /**
   * Bundle size breakdown by type
   */
  breakdown: {
    initial: number;
    async: number;
    common: number;
    vendor: number;
  };
  
  /**
   * Largest bundles
   */
  largestBundles: BundleInfo[];
  
  /**
   * Largest modules
   */
  largestModules: Array<{
    name: string;
    size: number;
    path?: string;
  }>;
  
  /**
   * Duplicate modules
   */
  duplicateModules: Array<{
    name: string;
    instances: number;
    totalSize: number;
  }>;
  
  /**
   * Module count
   */
  moduleCount: number;
}

export interface BundleAnalysisOptions {
  /**
   * Include module details in analysis
   */
  includeModules?: boolean;
  
  /**
   * Maximum number of large bundles to include in report
   */
  largestBundleLimit?: number;
  
  /**
   * Maximum number of large modules to include in report
   */
  largestModuleLimit?: number;
  
  /**
   * Filter bundles by name pattern
   */
  bundleFilter?: string;
}

/**
 * Analyzes client and server bundle sizes
 */
export function analyzeBundleSizes(
  clientBundles: BundleInfo[],
  serverBundles: BundleInfo[],
  options: BundleAnalysisOptions = {}
): BundleSizeMetrics {
  const {
    includeModules = true,
    largestBundleLimit = 5,
    largestModuleLimit = 10,
    bundleFilter,
  } = options;
  
  // Filter bundles if needed
  let filteredClientBundles = clientBundles;
  let filteredServerBundles = serverBundles;
  
  if (bundleFilter) {
    const regex = new RegExp(bundleFilter);
    filteredClientBundles = clientBundles.filter(b => regex.test(b.name));
    filteredServerBundles = serverBundles.filter(b => regex.test(b.name));
  }
  
  // Calculate client-side metrics
  const clientInitialSize = filteredClientBundles
    .filter(b => b.type === 'initial')
    .reduce((sum, b) => sum + b.size, 0);
  
  const clientAsyncSize = filteredClientBundles
    .filter(b => b.type === 'async')
    .reduce((sum, b) => sum + b.size, 0);
  
  const clientHydrationSize = filteredClientBundles
    .filter(b => b.isHydration)
    .reduce((sum, b) => sum + b.size, 0);
  
  const clientTotalSize = filteredClientBundles.reduce((sum, b) => sum + b.size, 0);
  
  // Calculate server-side metrics
  const serverInitialSize = filteredServerBundles
    .filter(b => b.type === 'initial')
    .reduce((sum, b) => sum + b.size, 0);
  
  const serverAsyncSize = filteredServerBundles
    .filter(b => b.type === 'async')
    .reduce((sum, b) => sum + b.size, 0);
  
  const serverTotalSize = filteredServerBundles.reduce((sum, b) => sum + b.size, 0);
  
  // Calculate breakdown by type
  const initialSize = filteredClientBundles
    .concat(filteredServerBundles)
    .filter(b => b.type === 'initial')
    .reduce((sum, b) => sum + b.size, 0);
  
  const asyncSize = filteredClientBundles
    .concat(filteredServerBundles)
    .filter(b => b.type === 'async')
    .reduce((sum, b) => sum + b.size, 0);
  
  const commonSize = filteredClientBundles
    .concat(filteredServerBundles)
    .filter(b => b.type === 'common')
    .reduce((sum, b) => sum + b.size, 0);
  
  const vendorSize = filteredClientBundles
    .concat(filteredServerBundles)
    .filter(b => b.type === 'vendor')
    .reduce((sum, b) => sum + b.size, 0);
  
  // Calculate size totals
  const totalSize = clientTotalSize + serverTotalSize;
  
  const totalMinifiedSize = filteredClientBundles
    .concat(filteredServerBundles)
    .reduce((sum, b) => sum + (b.minifiedSize || b.size), 0);
  
  const totalGzippedSize = filteredClientBundles
    .concat(filteredServerBundles)
    .reduce((sum, b) => sum + (b.gzippedSize || (b.minifiedSize || b.size) * 0.3), 0);
  
  // Find largest bundles
  const allBundles = [...filteredClientBundles, ...filteredServerBundles];
  const largestBundles = [...allBundles]
    .sort((a, b) => b.size - a.size)
    .slice(0, largestBundleLimit);
  
  // Process modules if included
  let largestModules: Array<{ name: string; size: number; path?: string }> = [];
  let duplicateModules: Array<{ name: string; instances: number; totalSize: number }> = [];
  let moduleCount = 0;
  
  if (includeModules) {
    // Collect all modules
    const allModules: Array<{ name: string; size: number; path?: string }> = [];
    
    allBundles.forEach(bundle => {
      if (bundle.modules) {
        allModules.push(...bundle.modules);
      }
    });
    
    moduleCount = allModules.length;
    
    // Find largest modules
    largestModules = [...allModules]
      .sort((a, b) => b.size - a.size)
      .slice(0, largestModuleLimit);
    
    // Find duplicate modules
    const moduleMap = new Map<string, { count: number; totalSize: number }>();
    
    allModules.forEach(module => {
      const name = module.name;
      const existing = moduleMap.get(name);
      
      if (existing) {
        moduleMap.set(name, {
          count: existing.count + 1,
          totalSize: existing.totalSize + module.size,
        });
      } else {
        moduleMap.set(name, { count: 1, totalSize: module.size });
      }
    });
    
    // Filter to only duplicates and sort by total size
    duplicateModules = Array.from(moduleMap.entries())
      .filter(([_, info]) => info.count > 1)
      .map(([name, info]) => ({
        name,
        instances: info.count,
        totalSize: info.totalSize,
      }))
      .sort((a, b) => b.totalSize - a.totalSize);
  }
  
  return {
    totalSize,
    totalMinifiedSize,
    totalGzippedSize,
    client: {
      initialSize: clientInitialSize,
      asyncSize: clientAsyncSize,
      hydrationSize: clientHydrationSize,
      totalSize: clientTotalSize,
    },
    server: {
      initialSize: serverInitialSize,
      asyncSize: serverAsyncSize,
      totalSize: serverTotalSize,
    },
    breakdown: {
      initial: initialSize,
      async: asyncSize,
      common: commonSize,
      vendor: vendorSize,
    },
    largestBundles,
    largestModules,
    duplicateModules,
    moduleCount,
  };
}

/**
 * Creates a bundle size comparison between SSR and CSR
 */
export function compareSSRtoCSR(
  ssrMetrics: BundleSizeMetrics,
  csrMetrics: BundleSizeMetrics
): {
  totalSizeDiff: number;
  totalSizeDiffPercentage: number;
  initialLoadSizeDiff: number;
  initialLoadSizeDiffPercentage: number;
  hydrationCost: number;
  serverBundleSize: number;
  recommendation: 'SSR' | 'CSR' | 'Hybrid';
  analysis: string;
} {
  // Calculate size differences
  const totalSizeDiff = ssrMetrics.totalSize - csrMetrics.totalSize;
  const totalSizeDiffPercentage = (totalSizeDiff / csrMetrics.totalSize) * 100;
  
  // Calculate initial load size difference (initial bundles + hydration)
  const ssrInitialLoad = ssrMetrics.client.initialSize + ssrMetrics.client.hydrationSize;
  const csrInitialLoad = csrMetrics.client.initialSize;
  
  const initialLoadSizeDiff = ssrInitialLoad - csrInitialLoad;
  const initialLoadSizeDiffPercentage = (initialLoadSizeDiff / csrInitialLoad) * 100;
  
  // Hydration cost
  const hydrationCost = ssrMetrics.client.hydrationSize;
  
  // Server bundle size
  const serverBundleSize = ssrMetrics.server.totalSize;
  
  // Make a recommendation
  let recommendation: 'SSR' | 'CSR' | 'Hybrid' = 'Hybrid';
  let analysis = '';
  
  if (initialLoadSizeDiff < 0 && initialLoadSizeDiffPercentage < -10) {
    // SSR reduces initial download by more than 10%
    recommendation = 'SSR';
    analysis = 'SSR significantly reduces initial JavaScript size. Recommended for better performance.';
  } else if (initialLoadSizeDiff > 0 && initialLoadSizeDiffPercentage > 20) {
    // SSR increases initial download by more than 20%
    recommendation = 'CSR';
    analysis = 'SSR significantly increases initial JavaScript size. CSR may be more efficient.';
  } else {
    // Difference is not substantial
    recommendation = 'Hybrid';
    analysis = 'Consider a hybrid approach with selective SSR for critical content.';
  }
  
  // Add additional analysis
  if (hydrationCost > 50000) {
    analysis += ' Hydration cost is high, consider optimizing or selective hydration.';
  }
  
  if (serverBundleSize > 1000000) {
    analysis += ' Server bundle size is large, which may impact server performance.';
  }
  
  if (ssrMetrics.duplicateModules.length > csrMetrics.duplicateModules.length) {
    analysis += ' SSR introduces more duplicate modules, consider code splitting optimization.';
  }
  
  return {
    totalSizeDiff,
    totalSizeDiffPercentage,
    initialLoadSizeDiff,
    initialLoadSizeDiffPercentage,
    hydrationCost,
    serverBundleSize,
    recommendation,
    analysis,
  };
}

export const BundleSizeAnalyzer = {
  analyzeBundleSizes,
  compareSSRtoCSR,
};

export default BundleSizeAnalyzer;