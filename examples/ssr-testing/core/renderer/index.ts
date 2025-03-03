/**
 * SSR Renderer
 * 
 * A utility for rendering React components on the server and capturing the output.
 * Supports different rendering modes (synchronous, asynchronous, streaming).
 */

import React from 'react';
import { renderToString, renderToStaticMarkup, renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'stream';

export type RenderMode = 'string' | 'static' | 'stream';

export interface RenderOptions {
  /**
   * The rendering mode to use
   */
  mode?: RenderMode;
  
  /**
   * Wait for all Suspense boundaries to resolve before returning
   */
  waitForSuspense?: boolean;
  
  /**
   * Capture client-side state during rendering
   */
  captureState?: boolean;
  
  /**
   * Custom headers to include in the response
   */
  headers?: Record<string, string>;
  
  /**
   * Timeout for rendering in milliseconds
   */
  timeout?: number;
}

export interface StreamRenderResult {
  /**
   * The rendered HTML content
   */
  html: string;
  
  /**
   * Stream chunks and their timing information
   */
  chunks: Array<{
    content: string;
    timeOffset: number;
  }>;
  
  /**
   * Time to first byte in milliseconds
   */
  timeToFirstByte: number;
  
  /**
   * Total rendering time in milliseconds
   */
  totalTime: number;
}

export interface RenderResult {
  /**
   * The rendered HTML content
   */
  html: string;
  
  /**
   * The time it took to render in milliseconds
   */
  renderTime: number;
  
  /**
   * The size of the rendered HTML in bytes
   */
  size: number;
  
  /**
   * Any errors that occurred during rendering
   */
  errors: Error[];
  
  /**
   * Client-side state captured during rendering (if captureState is true)
   */
  state?: Record<string, any>;
  
  /**
   * Stream results (if mode is 'stream')
   */
  stream?: StreamRenderResult;
}

/**
 * Renders a React component on the server and returns the result
 */
export async function render(
  element: React.ReactElement,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const {
    mode = 'string',
    waitForSuspense = true,
    captureState = false,
    timeout = 5000,
  } = options;
  
  const startTime = Date.now();
  let html = '';
  const errors: Error[] = [];
  let state: Record<string, any> = {};
  let streamResult: StreamRenderResult | undefined;
  
  try {
    if (mode === 'string') {
      html = renderToString(element);
    } else if (mode === 'static') {
      html = renderToStaticMarkup(element);
    } else if (mode === 'stream') {
      streamResult = await renderWithStream(element, timeout);
      html = streamResult.html;
    }
    
    if (captureState) {
      // TODO: Implement state capture
      state = {};
    }
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)));
  }
  
  const renderTime = Date.now() - startTime;
  
  return {
    html,
    renderTime,
    size: Buffer.byteLength(html, 'utf8'),
    errors,
    state: captureState ? state : undefined,
    stream: streamResult,
  };
}

/**
 * Renders a React component using streaming and returns the result
 */
async function renderWithStream(
  element: React.ReactElement,
  timeout: number
): Promise<StreamRenderResult> {
  return new Promise((resolve, reject) => {
    const chunks: Array<{ content: string; timeOffset: number }> = [];
    let html = '';
    const startTime = Date.now();
    let timeToFirstByte = 0;
    
    const stream = new PassThrough();
    
    stream.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      const timeOffset = Date.now() - startTime;
      
      if (chunks.length === 0) {
        timeToFirstByte = timeOffset;
      }
      
      chunks.push({ content: chunkStr, timeOffset });
      html += chunkStr;
    });
    
    stream.on('end', () => {
      const totalTime = Date.now() - startTime;
      resolve({
        html,
        chunks,
        timeToFirstByte,
        totalTime,
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
    
    // Set a timeout
    const timeoutId = setTimeout(() => {
      stream.end();
      reject(new Error(`Rendering timed out after ${timeout}ms`));
    }, timeout);
    
    stream.on('end', () => {
      clearTimeout(timeoutId);
    });
  });
}

export const SSRRenderer = {
  render,
};

export default SSRRenderer;