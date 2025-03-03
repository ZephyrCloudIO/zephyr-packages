/**
 * Render Timer
 * 
 * A utility for measuring server rendering time and client hydration time.
 * Provides detailed metrics for performance analysis.
 */

import React from 'react';
import { renderToString, renderToPipeableStream } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { PassThrough } from 'stream';

export interface RenderMetrics {
  /**
   * Total rendering time in milliseconds
   */
  totalTime: number;
  
  /**
   * Time spent in different rendering phases (milliseconds)
   */
  phases: {
    initialization: number;
    rendering: number;
    serialization: number;
  };
  
  /**
   * Memory usage during rendering (bytes)
   */
  memory: {
    before: number;
    after: number;
    delta: number;
  };
  
  /**
   * Size of rendered HTML (bytes)
   */
  outputSize: number;
}

export interface StreamRenderMetrics extends RenderMetrics {
  /**
   * Stream-specific metrics
   */
  stream: {
    /**
     * Time to first byte in milliseconds
     */
    timeToFirstByte: number;
    
    /**
     * Chunk delivery timings
     */
    chunks: Array<{
      size: number;
      timeOffset: number;
    }>;
    
    /**
     * Total number of chunks
     */
    chunkCount: number;
  };
}

export interface HydrationMetrics {
  /**
   * Total hydration time in milliseconds
   */
  totalTime: number;
  
  /**
   * Time spent in different hydration phases (milliseconds)
   */
  phases: {
    initialization: number;
    hydration: number;
    eventAttachment: number;
  };
  
  /**
   * Memory usage during hydration (bytes)
   */
  memory: {
    before: number;
    after: number;
    delta: number;
  };
}

/**
 * Measures server rendering time for a React component
 */
export async function measureRendering(
  element: React.ReactElement
): Promise<RenderMetrics> {
  // Capture initial memory usage
  const memoryBefore = process.memoryUsage().heapUsed;
  
  // Measure initialization phase
  const startInit = Date.now();
  const componentType = element.type;
  const props = element.props;
  const endInit = Date.now();
  
  // Measure rendering phase
  const startRender = Date.now();
  const html = renderToString(element);
  const endRender = Date.now();
  
  // Measure serialization phase (minimal in this case)
  const startSerialization = Date.now();
  const outputSize = Buffer.byteLength(html, 'utf8');
  const endSerialization = Date.now();
  
  // Capture final memory usage
  const memoryAfter = process.memoryUsage().heapUsed;
  
  return {
    totalTime: endSerialization - startInit,
    phases: {
      initialization: endInit - startInit,
      rendering: endRender - startRender,
      serialization: endSerialization - startSerialization,
    },
    memory: {
      before: memoryBefore,
      after: memoryAfter,
      delta: memoryAfter - memoryBefore,
    },
    outputSize,
  };
}

/**
 * Measures streaming server rendering time for a React component
 */
export async function measureStreamRendering(
  element: React.ReactElement
): Promise<StreamRenderMetrics> {
  return new Promise((resolve, reject) => {
    // Capture initial memory usage
    const memoryBefore = process.memoryUsage().heapUsed;
    
    // Measure initialization phase
    const startInit = Date.now();
    const componentType = element.type;
    const props = element.props;
    const endInit = Date.now();
    
    // Prepare for streaming
    const chunks: Array<{ size: number; timeOffset: number }> = [];
    let html = '';
    let timeToFirstByte = 0;
    
    // Create a passthrough stream
    const stream = new PassThrough();
    
    // Start rendering phase
    const startRender = Date.now();
    
    stream.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      const timeOffset = Date.now() - startRender;
      
      if (chunks.length === 0) {
        timeToFirstByte = timeOffset;
      }
      
      chunks.push({ 
        size: Buffer.byteLength(chunkStr, 'utf8'),
        timeOffset 
      });
      
      html += chunkStr;
    });
    
    stream.on('end', () => {
      const endRender = Date.now();
      
      // Measure serialization phase (minimal in this case)
      const startSerialization = Date.now();
      const outputSize = Buffer.byteLength(html, 'utf8');
      const endSerialization = Date.now();
      
      // Capture final memory usage
      const memoryAfter = process.memoryUsage().heapUsed;
      
      resolve({
        totalTime: endSerialization - startInit,
        phases: {
          initialization: endInit - startInit,
          rendering: endRender - startRender,
          serialization: endSerialization - startSerialization,
        },
        memory: {
          before: memoryBefore,
          after: memoryAfter,
          delta: memoryAfter - memoryBefore,
        },
        outputSize,
        stream: {
          timeToFirstByte,
          chunks,
          chunkCount: chunks.length,
        },
      });
    });
    
    stream.on('error', (error) => {
      reject(error);
    });
    
    const { pipe } = renderToPipeableStream(element, {
      onAllReady() {
        pipe(stream);
      },
      onError(error) {
        reject(error);
      },
    });
  });
}

/**
 * Measures client hydration time for server-rendered HTML
 */
export async function measureHydration(
  html: string,
  element: React.ReactElement
): Promise<HydrationMetrics> {
  // Create a container element with the server-rendered HTML
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  
  // Capture initial memory usage (client-side approximation)
  const memoryBefore = window.performance?.memory?.usedJSHeapSize || 0;
  
  // Measure initialization phase
  const startInit = Date.now();
  const componentType = element.type;
  const props = element.props;
  const endInit = Date.now();
  
  // Measure hydration phase
  const startHydration = Date.now();
  const root = hydrateRoot(container, element);
  const endHydration = Date.now();
  
  // Measure event attachment phase (approximation)
  const startEventAttachment = Date.now();
  // Trigger a microtask to ensure event listeners are attached
  await Promise.resolve();
  const endEventAttachment = Date.now();
  
  // Capture final memory usage (client-side approximation)
  const memoryAfter = window.performance?.memory?.usedJSHeapSize || 0;
  
  // Cleanup
  document.body.removeChild(container);
  
  return {
    totalTime: endEventAttachment - startInit,
    phases: {
      initialization: endInit - startInit,
      hydration: endHydration - startHydration,
      eventAttachment: endEventAttachment - startEventAttachment,
    },
    memory: {
      before: memoryBefore,
      after: memoryAfter,
      delta: memoryAfter - memoryBefore,
    },
  };
}

export const RenderTimer = {
  measureRendering,
  measureStreamRendering,
  measureHydration,
};

export default RenderTimer;