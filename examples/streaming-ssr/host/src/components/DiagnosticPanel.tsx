'use client';

import React, { useState, useEffect } from 'react';

interface DiagnosticPanelProps {
  id: string;
  data?: Record<string, any>;
}

export default function DiagnosticPanel({ id, data = {} }: DiagnosticPanelProps) {
  const [metrics, setMetrics] = useState<Record<string, any>>({
    ttfb: null,
    fcp: null,
    lcp: null,
    renderTime: null,
    hydrationTime: null,
    componentCount: 0,
    suspenseCount: 0,
  });
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Calculate basic timing metrics
    const ttfb = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paintEntries = window.performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    
    // Get component counts if available
    const componentCountEl = document.querySelector(`[data-diagnostics="${id}-components"]`);
    const suspenseCountEl = document.querySelector(`[data-diagnostics="${id}-suspense"]`);
    
    // Calculate streaming metrics
    const startTime = window.__streamingStartTime || 0;
    const nowTime = performance.now();
    const renderTime = startTime > 0 ? nowTime - startTime : null;
    
    setMetrics({
      ttfb: ttfb ? Math.round(ttfb.responseStart - ttfb.requestStart) : null,
      fcp: fcpEntry ? Math.round(fcpEntry.startTime) : null,
      lcp: null, // LCP requires more complex measurement
      renderTime: renderTime ? Math.round(renderTime) : null,
      hydrationTime: window.__hydrationTime ? Math.round(window.__hydrationTime) : null,
      componentCount: componentCountEl ? parseInt(componentCountEl.textContent || '0', 10) : 0,
      suspenseCount: suspenseCountEl ? parseInt(suspenseCountEl.textContent || '0', 10) : 0,
      ...data
    });
    
    // Setup LCP measurement
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            setMetrics(prev => ({
              ...prev,
              lcp: Math.round(lastEntry.startTime)
            }));
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) {
        console.error('LCP measurement failed:', e);
      }
    }
  }, [id, data]);
  
  return (
    <div className="diagnostic-panel">
      <h3 className="diagnostic-title">Streaming Diagnostics</h3>
      <div className="diagnostic-info">
        <div className="diagnostic-row">
          <span className="diagnostic-label">Time to First Byte:</span>
          <span className="diagnostic-value">
            {metrics.ttfb !== null ? `${metrics.ttfb}ms` : 'Measuring...'}
          </span>
        </div>
        <div className="diagnostic-row">
          <span className="diagnostic-label">First Contentful Paint:</span>
          <span className="diagnostic-value">
            {metrics.fcp !== null ? `${metrics.fcp}ms` : 'Measuring...'}
          </span>
        </div>
        <div className="diagnostic-row">
          <span className="diagnostic-label">Largest Contentful Paint:</span>
          <span className="diagnostic-value">
            {metrics.lcp !== null ? `${metrics.lcp}ms` : 'Measuring...'}
          </span>
        </div>
        <div className="diagnostic-row">
          <span className="diagnostic-label">Stream Render Time:</span>
          <span className="diagnostic-value">
            {metrics.renderTime !== null ? `${metrics.renderTime}ms` : 'Measuring...'}
          </span>
        </div>
        <div className="diagnostic-row">
          <span className="diagnostic-label">Hydration Time:</span>
          <span className="diagnostic-value">
            {metrics.hydrationTime !== null ? `${metrics.hydrationTime}ms` : 'N/A'}
          </span>
        </div>
        <div className="diagnostic-row">
          <span className="diagnostic-label">Components:</span>
          <span className="diagnostic-value">{metrics.componentCount}</span>
        </div>
        <div className="diagnostic-row">
          <span className="diagnostic-label">Suspense Boundaries:</span>
          <span className="diagnostic-value">{metrics.suspenseCount}</span>
        </div>
        
        {/* Render any additional provided metrics */}
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="diagnostic-row">
            <span className="diagnostic-label">{key}:</span>
            <span className="diagnostic-value">
              {typeof value === 'number' ? value.toFixed(2) : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Types for window augmentation
declare global {
  interface Window {
    __streamingStartTime: number;
    __hydrationTime?: number;
  }
  
  interface PerformanceEntry {
    startTime: number;
    duration: number;
    entryType: string;
    name: string;
  }
}