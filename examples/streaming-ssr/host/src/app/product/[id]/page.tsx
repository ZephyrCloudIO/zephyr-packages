'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import DiagnosticPanel from '../../../components/DiagnosticPanel';
import PrioritySelector from '../../../components/PrioritySelector';
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

const ProgressiveHydration = dynamic(() => import('shell/ProgressiveHydration'), {
  ssr: true,
  loading: () => <div className="loading-shell">Loading progressive hydration...</div>
});

// Import remote streaming components
const ProductStream = dynamic(() => import('remote/ProductStream'), {
  ssr: true,
  loading: () => <div className="loading-component">Loading product component...</div>
});

const CommentsStream = dynamic(() => import('remote/CommentsStream'), {
  ssr: true,
  loading: () => <div className="loading-component">Loading comments component...</div>
});

const RecommendationsStream = dynamic(() => import('remote/RecommendationsStream'), {
  ssr: true,
  loading: () => <div className="loading-component">Loading recommendations component...</div>
});

/**
 * Product page demonstrating progressive loading of critical and non-critical content
 * 
 * Features:
 * - Prioritizes critical content (product details)
 * - Defers non-critical content (comments, recommendations)
 * - Uses visibility-based loading for below-the-fold content
 * - Implements progressive hydration strategies
 */
export default function ProductPage({ params }: { params: { id: string } }) {
  const productId = params.id;
  const [priority, setPriority] = useState<StreamingPriority>('medium');
  const [loadingStrategy, setLoadingStrategy] = useState<'all' | 'progressive'>('progressive');
  
  // Track component visibility for diagnostics
  const [visibleSections, setVisibleSections] = useState<string[]>([]);
  
  // Setup visibility observers
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const sections = ['product', 'comments', 'recommendations'];
    const observers: IntersectionObserver[] = [];
    
    sections.forEach(section => {
      const element = document.getElementById(`section-${section}`);
      if (element) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              setVisibleSections(prev => 
                prev.includes(section) ? prev : [...prev, section]
              );
            } else {
              setVisibleSections(prev => 
                prev.filter(s => s !== section)
              );
            }
          });
        }, { threshold: 0.1 });
        
        observer.observe(element);
        observers.push(observer);
      }
    });
    
    return () => {
      observers.forEach(observer => observer.disconnect());
    };
  }, []);
  
  return (
    <div className="product-page">
      <h1 className="page-title">Product Details</h1>
      <p className="page-description">
        This page demonstrates progressive loading strategies with critical and non-critical content.
        The product details are loaded with high priority, while comments and recommendations are
        loaded progressively as they become visible.
      </p>
      
      {/* Diagnostic information */}
      <DiagnosticPanel 
        id="product" 
        data={{ 
          visibleSections: visibleSections.join(', '),
          loadingStrategy
        }} 
      />
      
      {/* Controls for demonstration */}
      <div className="controls-panel">
        <div>
          <h3>Loading Priority</h3>
          <PrioritySelector value={priority} onChange={setPriority} />
        </div>
        
        <div>
          <h3>Loading Strategy</h3>
          <div className="strategy-selector">
            <button 
              className={`strategy-button ${loadingStrategy === 'all' ? 'active' : ''}`}
              onClick={() => setLoadingStrategy('all')}
            >
              Load All At Once
            </button>
            <button 
              className={`strategy-button ${loadingStrategy === 'progressive' ? 'active' : ''}`}
              onClick={() => setLoadingStrategy('progressive')}
            >
              Progressive Loading
            </button>
          </div>
        </div>
      </div>
      
      {/* Critical section: Product Details */}
      <section id="section-product" className="page-section">
        <StreamingLayout 
          title="Product Details"
          priority="critical"
          critical={true}
          showDiagnostics={true}
        >
          <ProductStream 
            productId={productId}
            priority="critical"
          />
        </StreamingLayout>
      </section>
      
      {/* Non-critical section: Comments */}
      <section id="section-comments" className="page-section">
        {loadingStrategy === 'progressive' ? (
          <StreamingRegion
            priority={priority}
            deferTime={1000}
            visibilityThreshold={0.1}
          >
            <StreamingLayout 
              title="Customer Reviews"
              priority={priority}
              showDiagnostics={true}
            >
              <ProgressiveHydration priority={priority}>
                <CommentsStream 
                  contentId={`product-${productId}`}
                  priority={priority}
                />
              </ProgressiveHydration>
            </StreamingLayout>
          </StreamingRegion>
        ) : (
          <StreamingLayout 
            title="Customer Reviews"
            priority={priority}
            showDiagnostics={true}
          >
            <CommentsStream 
              contentId={`product-${productId}`}
              priority={priority}
            />
          </StreamingLayout>
        )}
      </section>
      
      {/* Non-critical section: Recommendations */}
      <section id="section-recommendations" className="page-section">
        {loadingStrategy === 'progressive' ? (
          <StreamingRegion
            priority={priority === 'high' ? 'medium' : priority === 'medium' ? 'low' : 'low'}
            deferTime={2000}
            visibilityThreshold={0.1}
          >
            <StreamingLayout 
              title="You May Also Like"
              priority={priority === 'high' ? 'medium' : priority === 'medium' ? 'low' : 'low'}
              showDiagnostics={true}
            >
              <ProgressiveHydration 
                priority={priority === 'high' ? 'medium' : priority === 'medium' ? 'low' : 'low'}
                hydrateOnInteraction={true}
              >
                <RecommendationsStream 
                  productId={productId}
                  priority={priority === 'high' ? 'medium' : priority === 'medium' ? 'low' : 'low'}
                />
              </ProgressiveHydration>
            </StreamingLayout>
          </StreamingRegion>
        ) : (
          <StreamingLayout 
            title="You May Also Like"
            priority={priority}
            showDiagnostics={true}
          >
            <RecommendationsStream 
              productId={productId}
              priority={priority}
            />
          </StreamingLayout>
        )}
      </section>
      
      <style jsx>{`
        .controls-panel {
          display: flex;
          gap: 30px;
          margin-bottom: 32px;
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #dee2e6;
        }
        
        .controls-panel h3 {
          margin-top: 0;
          margin-bottom: 12px;
        }
        
        .strategy-selector {
          display: flex;
          gap: 10px;
        }
        
        .strategy-button {
          padding: 8px 16px;
          background-color: white;
          border: 1px solid #007bff;
          color: #007bff;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .strategy-button:hover {
          background-color: rgba(0, 123, 255, 0.1);
        }
        
        .strategy-button.active {
          background-color: #007bff;
          color: white;
        }
        
        .loading-shell, 
        .loading-component {
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 8px;
          text-align: center;
          color: #6c757d;
        }
        
        @media (max-width: 768px) {
          .controls-panel {
            flex-direction: column;
            gap: 20px;
          }
        }
      `}</style>
    </div>
  );
}