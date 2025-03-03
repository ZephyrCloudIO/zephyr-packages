'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import DiagnosticPanel from '../../components/DiagnosticPanel';
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

const ResourcePrioritizer = dynamic(() => import('shell/ResourcePrioritizer'), {
  ssr: true,
  loading: () => <div className="loading-shell">Loading resource prioritizer...</div>
});

// Import remote streaming components
const ProductStream = dynamic(() => import('remote/ProductStream'), {
  ssr: true,
  loading: () => <div className="loading-component">Loading product component...</div>
});

const ProfileStream = dynamic(() => import('remote/ProfileStream'), {
  ssr: true,
  loading: () => <div className="loading-component">Loading profile component...</div>
});

const RecommendationsStream = dynamic(() => import('remote/RecommendationsStream'), {
  ssr: true,
  loading: () => <div className="loading-component">Loading recommendations component...</div>
});

const CommentsStream = dynamic(() => import('remote/CommentsStream'), {
  ssr: true,
  loading: () => <div className="loading-component">Loading comments component...</div>
});

/**
 * Dashboard page demonstrating complex streaming with multiple nested suspense boundaries
 * 
 * Features:
 * - Complex layout with multiple streaming regions
 * - Resource prioritization for optimal loading order
 * - Nested suspense boundaries
 * - Visual representation of loading sequence
 */
export default function DashboardPage() {
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  
  // Define resources with priorities for the ResourcePrioritizer
  const dashboardResources = [
    {
      id: 'profile',
      priority: 'critical' as StreamingPriority,
      load: () => import('remote/ProfileStream')
    },
    {
      id: 'products',
      priority: 'high' as StreamingPriority,
      load: () => import('remote/ProductStream')
    },
    {
      id: 'recommendations',
      priority: 'medium' as StreamingPriority,
      load: () => import('remote/RecommendationsStream')
    },
    {
      id: 'comments',
      priority: 'low' as StreamingPriority,
      load: () => import('remote/CommentsStream')
    }
  ];
  
  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">
            This page demonstrates complex streaming with multiple nested suspense boundaries.
            Components are loaded in order of priority and different regions stream independently.
          </p>
        </div>
        
        <div className="diagnostics-toggle">
          <label>
            <input 
              type="checkbox" 
              checked={showDiagnostics} 
              onChange={() => setShowDiagnostics(!showDiagnostics)}
            />
            Show Diagnostics
          </label>
        </div>
      </div>
      
      {/* Diagnostic information */}
      {showDiagnostics && <DiagnosticPanel id="dashboard" />}
      
      {/* Main dashboard with resource prioritization */}
      <ResourcePrioritizer 
        resources={dashboardResources}
        showStatus={showDiagnostics}
        concurrentLoads={2}
      >
        <div className="dashboard-layout">
          {/* Left column - Critical and high priority content */}
          <div className="dashboard-left">
            <StreamingRegion priority="critical" visibilityThreshold={0}>
              <StreamingLayout 
                title="User Profile"
                priority="critical"
                critical={true}
                showDiagnostics={showDiagnostics}
              >
                <ProfileStream 
                  userId="1"
                  detailed={true}
                  priority="critical"
                />
              </StreamingLayout>
            </StreamingRegion>
            
            <StreamingRegion priority="high" deferTime={500}>
              <StreamingLayout 
                title="Featured Product"
                priority="high"
                showDiagnostics={showDiagnostics}
              >
                <ProductStream 
                  productId="2"
                  priority="high"
                />
              </StreamingLayout>
            </StreamingRegion>
          </div>
          
          {/* Right column - Medium and low priority content */}
          <div className="dashboard-right">
            <StreamingRegion priority="medium" deferTime={1000}>
              <StreamingLayout 
                title="Recommended For You"
                priority="medium"
                showDiagnostics={showDiagnostics}
              >
                <RecommendationsStream 
                  userId="1"
                  limit={3}
                  priority="medium"
                />
              </StreamingLayout>
            </StreamingRegion>
            
            <StreamingRegion priority="low" deferTime={2000} visibilityThreshold={0.3}>
              <StreamingLayout 
                title="Recent Comments"
                priority="low"
                showDiagnostics={showDiagnostics}
              >
                <CommentsStream 
                  contentId="dashboard"
                  limit={3}
                  priority="low"
                />
              </StreamingLayout>
            </StreamingRegion>
          </div>
        </div>
      </ResourcePrioritizer>
      
      <style jsx>{`
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }
        
        .diagnostics-toggle {
          padding: 10px;
          background-color: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
        }
        
        .diagnostics-toggle label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        
        .dashboard-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        
        .dashboard-left,
        .dashboard-right {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .loading-shell, 
        .loading-component {
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 8px;
          text-align: center;
          color: #6c757d;
        }
        
        @media (max-width: 992px) {
          .dashboard-layout {
            grid-template-columns: 1fr;
          }
          
          .dashboard-header {
            flex-direction: column;
            gap: 16px;
          }
        }
      `}</style>
    </div>
  );
}