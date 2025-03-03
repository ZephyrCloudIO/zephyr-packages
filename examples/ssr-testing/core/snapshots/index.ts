/**
 * Snapshot Tester
 * 
 * A utility for snapshot testing of SSR components.
 * Captures and compares rendered output for regressions.
 */

import React from 'react';
import { renderToString } from 'react-dom/server';
import crypto from 'crypto';

export interface SnapshotOptions {
  /**
   * Whether to strip HTML comments
   */
  stripComments?: boolean;
  
  /**
   * Whether to normalize whitespace
   */
  normalizeWhitespace?: boolean;
  
  /**
   * Whether to remove data-reactroot and other React-specific attributes
   */
  stripReactAttributes?: boolean;
  
  /**
   * Whether to remove script tags
   */
  stripScripts?: boolean;
  
  /**
   * Custom HTML preprocessing function
   */
  preprocess?: (html: string) => string;
}

export interface SnapshotResult {
  /**
   * The rendered HTML
   */
  html: string;
  
  /**
   * The processed HTML for comparison
   */
  processedHtml: string;
  
  /**
   * The snapshot hash
   */
  hash: string;
  
  /**
   * Whether the snapshot matches the expected snapshot
   */
  matches?: boolean;
  
  /**
   * The expected snapshot hash (if comparing)
   */
  expectedHash?: string;
  
  /**
   * Differences between the current and expected snapshot (if not matching)
   */
  diff?: string;
}

/**
 * Creates a snapshot of rendered component output
 */
export function createSnapshot(
  element: React.ReactElement,
  options: SnapshotOptions = {}
): SnapshotResult {
  const {
    stripComments = true,
    normalizeWhitespace = true,
    stripReactAttributes = true,
    stripScripts = true,
    preprocess,
  } = options;
  
  // Render the component to HTML
  let html = renderToString(element);
  
  // Process the HTML
  let processedHtml = html;
  
  if (stripComments) {
    processedHtml = processedHtml.replace(/<!--.*?-->/gs, '');
  }
  
  if (normalizeWhitespace) {
    processedHtml = processedHtml.replace(/\s+/g, ' ').trim();
  }
  
  if (stripReactAttributes) {
    processedHtml = processedHtml
      .replace(/\sdata-reactroot="[^"]*"/g, '')
      .replace(/\sdata-reactid="[^"]*"/g, '')
      .replace(/\sdata-react-checksum="[^"]*"/g, '');
  }
  
  if (stripScripts) {
    processedHtml = processedHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
  
  if (preprocess) {
    processedHtml = preprocess(processedHtml);
  }
  
  // Create a hash of the processed HTML
  const hash = crypto.createHash('md5').update(processedHtml).digest('hex');
  
  return {
    html,
    processedHtml,
    hash,
  };
}

/**
 * Compares a rendered snapshot with an expected snapshot
 */
export function compareSnapshot(
  element: React.ReactElement,
  expectedSnapshot: string | { hash: string; html: string },
  options: SnapshotOptions = {}
): SnapshotResult {
  // Create a new snapshot
  const snapshot = createSnapshot(element, options);
  
  // Extract expected hash and HTML
  let expectedHash: string;
  let expectedHtml: string;
  
  if (typeof expectedSnapshot === 'string') {
    expectedHtml = expectedSnapshot;
    expectedHash = crypto.createHash('md5').update(expectedSnapshot).digest('hex');
  } else {
    expectedHash = expectedSnapshot.hash;
    expectedHtml = expectedSnapshot.html;
  }
  
  // Compare hashes
  const matches = snapshot.hash === expectedHash;
  
  // If not matching, generate a diff
  let diff: string | undefined;
  if (!matches) {
    // Simple line-by-line diff
    const snapshotLines = snapshot.processedHtml.split('\n');
    const expectedLines = expectedHtml.split('\n');
    
    const diffLines: string[] = [];
    
    const maxLength = Math.max(snapshotLines.length, expectedLines.length);
    for (let i = 0; i < maxLength; i++) {
      const snapshotLine = i < snapshotLines.length ? snapshotLines[i] : '';
      const expectedLine = i < expectedLines.length ? expectedLines[i] : '';
      
      if (snapshotLine !== expectedLine) {
        diffLines.push(`- ${expectedLine}`);
        diffLines.push(`+ ${snapshotLine}`);
      } else {
        diffLines.push(`  ${snapshotLine}`);
      }
    }
    
    diff = diffLines.join('\n');
  }
  
  return {
    ...snapshot,
    matches,
    expectedHash,
    diff,
  };
}

/**
 * Serializes a snapshot result for storage
 */
export function serializeSnapshot(snapshot: SnapshotResult): string {
  return JSON.stringify({
    hash: snapshot.hash,
    html: snapshot.processedHtml,
  });
}

/**
 * Deserializes a snapshot from storage
 */
export function deserializeSnapshot(serialized: string): { hash: string; html: string } {
  return JSON.parse(serialized);
}

export const SnapshotTester = {
  createSnapshot,
  compareSnapshot,
  serializeSnapshot,
  deserializeSnapshot,
};

export default SnapshotTester;