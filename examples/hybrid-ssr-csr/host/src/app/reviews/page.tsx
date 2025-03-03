'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useFederation } from 'hybrid-ssr-csr-shared/dist/federation-context';
import ErrorBoundary from '../../components/ErrorBoundary';
import LoadingFallback from '../../components/LoadingFallback';

// Server component for the header
const ServerHeader = dynamic(() => import('ssrRemote/ServerHeader'), {
  loading: () => <LoadingFallback type="skeleton" />,
  ssr: true
});

// Client component for reviews
const ClientReviews = dynamic(() => import('csrRemote/ClientReviews'), {
  loading: () => <LoadingFallback type="dots" message="Loading reviews..." />,
  ssr: false // Client-side only
});

// Simulate a list of products
const products = [
  { id: 'product-1', name: 'Smartphone X' },
  { id: 'product-2', name: 'Wireless Headphones' },
  { id: 'product-3', name: 'Laptop Pro' },
  { id: 'product-4', name: 'Smart Watch' },
];

const ReviewsPage: React.FC = () => {
  const { themeMode } = useFederation();
  const [selectedProduct, setSelectedProduct] = useState(products[0].id);

  return (
    <div className="reviews-page">
      {/* Server-rendered header */}
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback type="skeleton" />}>
          <ServerHeader 
            title="Product Reviews" 
            subtitle="See what our customers are saying"
            themeMode={themeMode}
          />
        </Suspense>
      </ErrorBoundary>
      
      {/* Client-side product selector */}
      <div className="product-selector">
        <h3>Select a product to see reviews:</h3>
        <div className="product-buttons">
          {products.map(product => (
            <button
              key={product.id}
              className={selectedProduct === product.id ? 'active' : ''}
              onClick={() => setSelectedProduct(product.id)}
            >
              {product.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* Client-side reviews component */}
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback type="dots" message="Loading reviews..." />}>
          <div className="reviews-container">
            <ClientReviews productId={selectedProduct} />
          </div>
        </Suspense>
      </ErrorBoundary>
      
      <style jsx>{`
        .reviews-page {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }
        
        .product-selector {
          background-color: var(--color-background-alt);
          padding: 20px;
          border-radius: var(--border-radius);
          box-shadow: var(--box-shadow);
        }
        
        .product-selector h3 {
          margin-top: 0;
          margin-bottom: 15px;
          color: var(--color-text);
        }
        
        .product-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        
        .product-buttons button {
          background-color: var(--color-background);
          color: var(--color-text);
          border: 1px solid var(--color-border);
          border-radius: 4px;
          padding: 8px 16px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .product-buttons button:hover {
          border-color: var(--color-primary);
        }
        
        .product-buttons button.active {
          background-color: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }
        
        .reviews-container {
          min-height: 400px;
        }
        
        @media (max-width: 768px) {
          .product-buttons {
            flex-direction: column;
          }
          
          .product-buttons button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default ReviewsPage;