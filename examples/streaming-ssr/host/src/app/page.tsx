'use client';

import React, { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import DiagnosticPanel from '../components/DiagnosticPanel';
import PrioritySelector from '../components/PrioritySelector';
import { StreamingPriority } from 'streaming-ssr-shared/dist/types';

// Import shell streaming components
const StreamingLayout = dynamic(() => import('shell/StreamingLayout'), {
  ssr: true,
  loading: () => <div className="loading-shell">Loading streaming layout...</div>
});

const StreamingRegion = dynamic(() => import('shell/StreamingRegion'), {
  ssr: true,
  loading: () => <div className="loading-shell">Loading streaming region...</div>
});

// Import remote streaming components
const ProductStream = dynamic(() => import('remote/ProductStream'), {
  ssr: true,
  loading: () => <div className="loading-component">Loading product component...</div>
});

const RecommendationsStream = dynamic(() => import('remote/RecommendationsStream'), {
  ssr: true,
  loading: () => <div className="loading-component">Loading recommendations component...</div>
});

const ProfileStream = dynamic(() => import('remote/ProfileStream'), {
  ssr: true,
  loading: () => <div className="loading-component">Loading profile component...</div>
});

/**
 * Home page demonstrating basic streaming with suspense boundaries
 * 
 * Features:
 * - Configurable streaming priorities
 * - Multiple streaming regions
 * - Diagnostic information
 * - Simple streaming layout
 */
export default function HomePage() {
  // Allow changing priorities for demonstration
  const [priority, setPriority] = useState<StreamingPriority>('medium');
  
  return (
    <div className="home-page">
      <h1 className="page-title">Streaming SSR Demo</h1>
      <p className="page-description">
        This page demonstrates React 18 streaming with Module Federation. Components are loaded
        in order of priority and streamed to the client as they become available.
      </p>
      
      {/* Diagnostic information */}
      <DiagnosticPanel id="home" />
      
      {/* Priority selector for demonstration */}
      <div className="priority-control">
        <h3>Change Streaming Priority</h3>
        <p>Use these controls to see how different priorities affect loading order</p>
        <PrioritySelector value={priority} onChange={setPriority} />
      </div>
      
      {/* Main content grid with streaming components */}
      <div className="stream-grid">
        <div className="stream-column">
          <StreamingLayout 
            title="Featured Product"
            priority={priority}
            critical={priority === 'critical'}
            showDiagnostics={true}
          >
            <ProductStream 
              productId="1"
              priority={priority}
            />
          </StreamingLayout>
        </div>
        
        <div className="stream-column">
          <StreamingRegion priority={priority}>
            <StreamingLayout 
              title="Recommendations"
              priority={priority}
              showDiagnostics={true}
            >
              <RecommendationsStream 
                productId="1"
                limit={4}
                priority={priority}
              />
            </StreamingLayout>
          </StreamingRegion>
          
          <StreamingRegion priority={priority === 'critical' ? 'high' : priority}>
            <StreamingLayout 
              title="User Profile"
              priority={priority === 'critical' ? 'high' : priority}
              showDiagnostics={true}
            >
              <ProfileStream 
                userId="1"
                priority={priority === 'critical' ? 'high' : priority}
              />
            </StreamingLayout>
          </StreamingRegion>
        </div>
      </div>
      
      <style jsx>{`
        .priority-control {
          margin-bottom: 32px;
          padding: 16px;
          background-color: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #dee2e6;
        }
        
        .priority-control h3 {
          margin-top: 0;
          margin-bottom: 8px;
        }
        
        .priority-control p {
          margin-bottom: 16px;
          color: #6c757d;
        }
        
        .loading-shell, 
        .loading-component {
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 8px;
          text-align: center;
          color: #6c757d;
        }
      `}</style>
    </div>
  );
}