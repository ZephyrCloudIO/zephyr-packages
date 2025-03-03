/**
 * Streaming Analyzer
 * 
 * A utility for analyzing SSR streaming patterns and performance.
 * Measures chunk delivery, content priority, and streaming patterns.
 */

import React from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'stream';

export interface StreamChunk {
  /**
   * The chunk content
   */
  content: string;
  
  /**
   * Time offset from start of streaming (milliseconds)
   */
  timeOffset: number;
  
  /**
   * Size of the chunk in bytes
   */
  size: number;
  
  /**
   * Whether the chunk contains critical content
   */
  hasCriticalContent?: boolean;
  
  /**
   * Whether the chunk contains Suspense fallback content
   */
  hasSuspenseFallback?: boolean;
  
  /**
   * Whether the chunk contains resolved Suspense content
   */
  hasResolvedSuspense?: boolean;
}

export interface ContentPriority {
  /**
   * CSS selector for the content
   */
  selector: string;
  
  /**
   * Priority level (higher = more critical)
   */
  priority: number;
  
  /**
   * Whether the content is critical for user experience
   */
  isCritical: boolean;
  
  /**
   * Time when this content was delivered (milliseconds from start)
   */
  deliveryTime?: number;
  
  /**
   * Chunk index when this content was delivered
   */
  chunkIndex?: number;
}

export interface StreamingMetrics {
  /**
   * Total streaming time in milliseconds
   */
  totalTime: number;
  
  /**
   * Time to first byte in milliseconds
   */
  timeToFirstByte: number;
  
  /**
   * Time to first contentful paint (approximation) in milliseconds
   */
  timeToFirstContentfulPaint: number;
  
  /**
   * Time to largest contentful paint (approximation) in milliseconds
   */
  timeToLargestContentfulPaint: number;
  
  /**
   * Number of chunks delivered
   */
  chunkCount: number;
  
  /**
   * Average chunk size in bytes
   */
  averageChunkSize: number;
  
  /**
   * Content delivery metrics
   */
  contentDelivery: Array<{
    selector: string;
    priority: number;
    deliveryTime: number;
    chunkIndex: number;
  }>;
  
  /**
   * Suspense resolution metrics
   */
  suspenseResolution: Array<{
    /**
     * Time when Suspense fallback was shown
     */
    fallbackTime: number;
    
    /**
     * Time when Suspense content was resolved
     */
    resolvedTime: number;
    
    /**
     * Time it took to resolve the Suspense boundary
     */
    resolutionTime: number;
  }>;
}

export interface StreamingAnalysisOptions {
  /**
   * Content priority definitions
   */
  contentPriorities?: ContentPriority[];
  
  /**
   * Selectors for suspense fallbacks
   */
  suspenseFallbackSelectors?: string[];
  
  /**
   * Selectors for suspense content
   */
  suspenseContentSelectors?: string[];
  
  /**
   * Timeout for streaming in milliseconds
   */
  timeout?: number;
  
  /**
   * Whether to save raw chunk data
   */
  saveRawChunks?: boolean;
}

export interface StreamingAnalysisResult {
  /**
   * Streaming metrics
   */
  metrics: StreamingMetrics;
  
  /**
   * Raw stream chunks (if saveRawChunks is true)
   */
  chunks?: StreamChunk[];
  
  /**
   * The complete HTML output
   */
  html: string;
}

/**
 * Analyzes streaming patterns and performance
 */
export async function analyzeStreaming(
  element: React.ReactElement,
  options: StreamingAnalysisOptions = {}
): Promise<StreamingAnalysisResult> {
  const {
    contentPriorities = [],
    suspenseFallbackSelectors = [],
    suspenseContentSelectors = [],
    timeout = 5000,
    saveRawChunks = true,
  } = options;
  
  return new Promise((resolve, reject) => {
    const chunks: StreamChunk[] = [];
    let html = '';
    let startTime = Date.now();
    let timeToFirstByte = 0;
    
    // Content delivery tracking
    const contentDelivery: Array<{
      selector: string;
      priority: number;
      deliveryTime: number;
      chunkIndex: number;
    }> = [];
    
    // Suspense resolution tracking
    const suspenseFallbacks = new Set<string>();
    const suspenseResolution: Array<{
      fallbackTime: number;
      resolvedTime: number;
      resolutionTime: number;
    }> = [];
    
    // Create a passthrough stream
    const stream = new PassThrough();
    
    stream.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      const timeOffset = Date.now() - startTime;
      const size = Buffer.byteLength(chunkStr, 'utf8');
      
      if (chunks.length === 0) {
        timeToFirstByte = timeOffset;
      }
      
      // Check for critical content in this chunk
      let hasCriticalContent = false;
      
      // Check for content priorities
      for (const priority of contentPriorities) {
        if (chunkStr.includes(priority.selector)) {
          contentDelivery.push({
            selector: priority.selector,
            priority: priority.priority,
            deliveryTime: timeOffset,
            chunkIndex: chunks.length,
          });
          
          if (priority.isCritical) {
            hasCriticalContent = true;
          }
        }
      }
      
      // Check for Suspense fallbacks
      let hasSuspenseFallback = false;
      for (const selector of suspenseFallbackSelectors) {
        if (chunkStr.includes(selector) && !suspenseFallbacks.has(selector)) {
          suspenseFallbacks.add(selector);
          hasSuspenseFallback = true;
        }
      }
      
      // Check for resolved Suspense content
      let hasResolvedSuspense = false;
      for (const selector of suspenseContentSelectors) {
        if (chunkStr.includes(selector)) {
          // Find a matching fallback
          for (const fallback of Array.from(suspenseFallbacks)) {
            if (fallback.replace('fallback', 'content').includes(selector)) {
              const fallbackIndex = chunks.findIndex(c => 
                c.content.includes(fallback)
              );
              
              if (fallbackIndex >= 0) {
                const fallbackTime = chunks[fallbackIndex].timeOffset;
                suspenseResolution.push({
                  fallbackTime,
                  resolvedTime: timeOffset,
                  resolutionTime: timeOffset - fallbackTime,
                });
                hasResolvedSuspense = true;
              }
            }
          }
        }
      }
      
      chunks.push({ 
        content: chunkStr, 
        timeOffset,
        size,
        hasCriticalContent,
        hasSuspenseFallback,
        hasResolvedSuspense,
      });
      
      html += chunkStr;
    });
    
    stream.on('end', () => {
      const totalTime = Date.now() - startTime;
      
      // Calculate TTFCP - approximation based on first chunk with critical content
      let timeToFirstContentfulPaint = totalTime;
      for (const chunk of chunks) {
        if (chunk.hasCriticalContent) {
          timeToFirstContentfulPaint = chunk.timeOffset;
          break;
        }
      }
      
      // Calculate TTLCP - approximation based on last critical content
      let timeToLargestContentfulPaint = timeToFirstContentfulPaint;
      for (const content of contentDelivery) {
        if (content.priority >= 8) { // Assuming high priority >= 8
          timeToLargestContentfulPaint = content.deliveryTime;
        }
      }
      
      // Calculate average chunk size
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
      const averageChunkSize = chunks.length > 0 ? totalSize / chunks.length : 0;
      
      const metrics: StreamingMetrics = {
        totalTime,
        timeToFirstByte,
        timeToFirstContentfulPaint,
        timeToLargestContentfulPaint,
        chunkCount: chunks.length,
        averageChunkSize,
        contentDelivery,
        suspenseResolution,
      };
      
      resolve({
        metrics,
        chunks: saveRawChunks ? chunks : undefined,
        html,
      });
    });
    
    stream.on('error', (error) => {
      reject(error);
    });
    
    // Render to pipeable stream
    const { pipe } = renderToPipeableStream(element, {
      onAllReady() {
        pipe(stream);
      },
      onError(error) {
        reject(error);
      },
    });
    
    // Set a timeout
    const timeoutId = setTimeout(() => {
      stream.end();
      reject(new Error(`Streaming timed out after ${timeout}ms`));
    }, timeout);
    
    stream.on('end', () => {
      clearTimeout(timeoutId);
    });
  });
}

export const StreamingAnalyzer = {
  analyzeStreaming,
};

export default StreamingAnalyzer;