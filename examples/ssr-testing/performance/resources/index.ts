/**
 * Resource Loader
 * 
 * A utility for tracking and analyzing resource loading in SSR applications.
 * Measures script, style, and image loading performance.
 */

export interface ResourceInfo {
  /**
   * URL of the resource
   */
  url: string;
  
  /**
   * Type of the resource
   */
  type: 'script' | 'style' | 'image' | 'font' | 'other';
  
  /**
   * Size of the resource in bytes
   */
  size: number;
  
  /**
   * Load time in milliseconds
   */
  loadTime: number;
  
  /**
   * Whether the resource is async
   */
  async?: boolean;
  
  /**
   * Whether the resource is deferred
   */
  defer?: boolean;
  
  /**
   * Loading priority of the resource
   */
  priority?: 'high' | 'medium' | 'low' | 'auto';
  
  /**
   * Attributes of the resource element
   */
  attributes?: Record<string, string>;
}

export interface ResourceWaterfall {
  /**
   * Resources ordered by start time
   */
  resources: Array<{
    url: string;
    type: string;
    startTime: number;
    endTime: number;
    duration: number;
    size: number;
  }>;
  
  /**
   * Total duration of resource loading
   */
  totalDuration: number;
  
  /**
   * Total size of all resources
   */
  totalSize: number;
  
  /**
   * Maximum number of concurrent requests
   */
  maxConcurrent: number;
}

export interface ResourceMetrics {
  /**
   * Total number of resources
   */
  totalResources: number;
  
  /**
   * Breakdown by resource type
   */
  typeBreakdown: {
    script: number;
    style: number;
    image: number;
    font: number;
    other: number;
  };
  
  /**
   * Size breakdown by resource type (bytes)
   */
  sizeBreakdown: {
    script: number;
    style: number;
    image: number;
    font: number;
    other: number;
    total: number;
  };
  
  /**
   * Load time statistics (milliseconds)
   */
  loadTime: {
    min: number;
    max: number;
    avg: number;
    median: number;
    p95: number;
  };
  
  /**
   * Time to interactive estimation (milliseconds)
   */
  timeToInteractive: number;
  
  /**
   * First contentful paint estimation (milliseconds)
   */
  firstContentfulPaint: number;
  
  /**
   * Resource waterfall data
   */
  waterfall: ResourceWaterfall;
}

/**
 * Extracts resources from HTML content
 */
export function extractResources(html: string): ResourceInfo[] {
  const resources: ResourceInfo[] = [];
  
  // Extract scripts
  const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*>/g;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const url = scriptMatch[1];
    const scriptTag = scriptMatch[0];
    
    // Parse attributes
    const async = scriptTag.includes('async');
    const defer = scriptTag.includes('defer');
    
    resources.push({
      url,
      type: 'script',
      size: 0, // Will be populated during analysis
      loadTime: 0, // Will be populated during analysis
      async,
      defer,
      attributes: extractAttributes(scriptTag),
    });
  }
  
  // Extract styles
  const styleRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/g;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(html)) !== null) {
    const url = styleMatch[1];
    const styleTag = styleMatch[0];
    
    resources.push({
      url,
      type: 'style',
      size: 0,
      loadTime: 0,
      attributes: extractAttributes(styleTag),
    });
  }
  
  // Extract images
  const imageRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/g;
  let imageMatch;
  while ((imageMatch = imageRegex.exec(html)) !== null) {
    const url = imageMatch[1];
    const imgTag = imageMatch[0];
    
    // Determine loading priority
    let priority: 'high' | 'medium' | 'low' | 'auto' = 'auto';
    if (imgTag.includes('loading="lazy"')) {
      priority = 'low';
    } else if (imgTag.includes('fetchpriority="high"')) {
      priority = 'high';
    }
    
    resources.push({
      url,
      type: 'image',
      size: 0,
      loadTime: 0,
      priority,
      attributes: extractAttributes(imgTag),
    });
  }
  
  // Extract fonts
  const fontRegex = /<link[^>]*rel=["']preload["'][^>]*href=["']([^"']+)["'][^>]*as=["']font["'][^>]*>/g;
  let fontMatch;
  while ((fontMatch = fontRegex.exec(html)) !== null) {
    const url = fontMatch[1];
    const fontTag = fontMatch[0];
    
    resources.push({
      url,
      type: 'font',
      size: 0,
      loadTime: 0,
      attributes: extractAttributes(fontTag),
    });
  }
  
  return resources;
}

/**
 * Helper to extract attributes from an HTML tag
 */
function extractAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attrRegex = /(\w+)=["']([^"']*)["']/g;
  
  let match;
  while ((match = attrRegex.exec(tag)) !== null) {
    attributes[match[1]] = match[2];
  }
  
  return attributes;
}

/**
 * Simulates resource loading and generates metrics
 */
export async function analyzeResources(
  resources: ResourceInfo[]
): Promise<ResourceMetrics> {
  // Simulate sizes and load times (in a real implementation, would fetch actual sizes)
  const simulatedResources = await Promise.all(
    resources.map(async (resource) => {
      // Simulate resource size based on type
      let size = 0;
      switch (resource.type) {
        case 'script':
          size = Math.round(Math.random() * 100000) + 10000; // 10KB - 110KB
          break;
        case 'style':
          size = Math.round(Math.random() * 50000) + 5000; // 5KB - 55KB
          break;
        case 'image':
          size = Math.round(Math.random() * 500000) + 20000; // 20KB - 520KB
          break;
        case 'font':
          size = Math.round(Math.random() * 100000) + 20000; // 20KB - 120KB
          break;
        default:
          size = Math.round(Math.random() * 50000) + 1000; // 1KB - 51KB
      }
      
      // Simulate load time based on size and type
      let loadTime = Math.round((size / 1000) * (Math.random() + 0.5));
      
      // Adjust based on resource attributes
      if (resource.type === 'script' && resource.defer) {
        loadTime *= 0.8; // Deferred scripts load faster
      }
      
      if (resource.type === 'image' && resource.priority === 'low') {
        loadTime *= 1.5; // Low priority images load slower
      }
      
      return {
        ...resource,
        size,
        loadTime,
      };
    })
  );
  
  // Calculate type breakdown
  const typeBreakdown = {
    script: 0,
    style: 0,
    image: 0,
    font: 0,
    other: 0,
  };
  
  // Calculate size breakdown
  const sizeBreakdown = {
    script: 0,
    style: 0,
    image: 0,
    font: 0,
    other: 0,
    total: 0,
  };
  
  // Calculate load times
  const loadTimes: number[] = [];
  
  simulatedResources.forEach((resource) => {
    // Update type counts
    typeBreakdown[resource.type] = (typeBreakdown[resource.type] || 0) + 1;
    
    // Update size totals
    sizeBreakdown[resource.type] = (sizeBreakdown[resource.type] || 0) + resource.size;
    sizeBreakdown.total += resource.size;
    
    // Add to load times
    loadTimes.push(resource.loadTime);
  });
  
  // Calculate load time statistics
  loadTimes.sort((a, b) => a - b);
  const minLoadTime = loadTimes[0] || 0;
  const maxLoadTime = loadTimes[loadTimes.length - 1] || 0;
  const avgLoadTime = loadTimes.reduce((sum, time) => sum + time, 0) / (loadTimes.length || 1);
  const medianLoadTime = loadTimes[Math.floor(loadTimes.length / 2)] || 0;
  const p95Index = Math.floor(loadTimes.length * 0.95);
  const p95LoadTime = loadTimes[p95Index] || maxLoadTime;
  
  // Simulate waterfall
  const waterfall = simulateWaterfall(simulatedResources);
  
  // Estimate TTI and FCP
  const criticalScripts = simulatedResources.filter(
    r => r.type === 'script' && !r.defer && !r.async
  );
  const criticalStyles = simulatedResources.filter(r => r.type === 'style');
  
  const scriptLoadTime = criticalScripts.reduce(
    (max, script) => Math.max(max, script.loadTime),
    0
  );
  
  const styleLoadTime = criticalStyles.reduce(
    (max, style) => Math.max(max, style.loadTime),
    0
  );
  
  const firstContentfulPaint = Math.max(styleLoadTime, minLoadTime);
  const timeToInteractive = Math.max(scriptLoadTime, styleLoadTime) + 200; // Add 200ms for processing
  
  return {
    totalResources: simulatedResources.length,
    typeBreakdown,
    sizeBreakdown,
    loadTime: {
      min: minLoadTime,
      max: maxLoadTime,
      avg: avgLoadTime,
      median: medianLoadTime,
      p95: p95LoadTime,
    },
    timeToInteractive,
    firstContentfulPaint,
    waterfall,
  };
}

/**
 * Simulates resource waterfall loading
 */
function simulateWaterfall(resources: ResourceInfo[]): ResourceWaterfall {
  // Sort resources by priority and type
  const sortedResources = [...resources].sort((a, b) => {
    // Sort by priority first
    const aPriority = a.priority === 'high' ? 0 : a.priority === 'medium' ? 1 : 2;
    const bPriority = b.priority === 'high' ? 0 : b.priority === 'medium' ? 1 : 2;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // Then by type
    const typeOrder: Record<string, number> = {
      style: 0,
      font: 1,
      script: 2,
      image: 3,
      other: 4,
    };
    
    return (typeOrder[a.type] || 5) - (typeOrder[b.type] || 5);
  });
  
  // Simulate concurrent loading
  const maxConcurrentConnections = 6; // Browser typical limit
  const activeConnections: Array<{ endTime: number; resource: ResourceInfo }> = [];
  const waterfallResources: Array<{
    url: string;
    type: string;
    startTime: number;
    endTime: number;
    duration: number;
    size: number;
  }> = [];
  
  let currentTime = 0;
  
  for (const resource of sortedResources) {
    // Check if we can start loading this resource
    while (
      activeConnections.length >= maxConcurrentConnections &&
      activeConnections.length > 0
    ) {
      // Find the connection that will finish first
      const earliestCompletion = activeConnections.reduce(
        (min, conn) => (conn.endTime < min ? conn.endTime : min),
        Infinity
      );
      
      // Advance time to when the earliest connection completes
      currentTime = earliestCompletion;
      
      // Remove completed connections
      activeConnections = activeConnections.filter(
        conn => conn.endTime > currentTime
      );
    }
    
    // Start loading this resource
    const startTime = currentTime;
    const endTime = startTime + resource.loadTime;
    
    activeConnections.push({
      endTime,
      resource,
    });
    
    waterfallResources.push({
      url: resource.url,
      type: resource.type,
      startTime,
      endTime,
      duration: resource.loadTime,
      size: resource.size,
    });
  }
  
  // Calculate final metrics
  const lastEndTime = waterfallResources.reduce(
    (max, res) => Math.max(max, res.endTime),
    0
  );
  
  // Calculate max concurrent connections at any point
  let maxConcurrent = 0;
  
  // Create timeline with 10ms resolution
  const timeline: number[] = Array(Math.ceil(lastEndTime / 10) + 1).fill(0);
  
  for (const res of waterfallResources) {
    const startIndex = Math.floor(res.startTime / 10);
    const endIndex = Math.ceil(res.endTime / 10);
    
    for (let i = startIndex; i < endIndex; i++) {
      timeline[i]++;
      maxConcurrent = Math.max(maxConcurrent, timeline[i]);
    }
  }
  
  return {
    resources: waterfallResources,
    totalDuration: lastEndTime,
    totalSize: waterfallResources.reduce((sum, res) => sum + res.size, 0),
    maxConcurrent,
  };
}

export const ResourceLoader = {
  extractResources,
  analyzeResources,
};

export default ResourceLoader;