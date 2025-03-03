import React, { Suspense } from 'react';
import { Recommendation, StreamingPriority } from 'streaming-ssr-shared/dist/types';
import { fetchRecommendations } from 'streaming-ssr-shared/dist/data';
import { formatCurrency } from 'streaming-ssr-shared/dist/utils';

// Simulated fetch delay based on priority
const FETCH_DELAYS: Record<StreamingPriority, number> = {
  critical: 200,
  high: 2000,
  medium: 4000,
  low: 6000
};

interface RecommendationsStreamProps {
  userId?: string;
  productId?: string;
  limit?: number;
  priority?: StreamingPriority;
}

// Loading state
function RecommendationsSkeleton() {
  return (
    <div className="recommendations-skeleton">
      <div className="recommendations-skeleton-header"></div>
      
      <div className="recommendations-skeleton-items">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="recommendation-skeleton-item">
            <div className="recommendation-skeleton-image"></div>
            <div className="recommendation-skeleton-content">
              <div className="recommendation-skeleton-title"></div>
              <div className="recommendation-skeleton-price"></div>
              <div className="recommendation-skeleton-rating"></div>
            </div>
          </div>
        ))}
      </div>
      
      <style jsx>{`
        .recommendations-skeleton {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 20px;
          border-radius: 8px;
          background-color: #f9f9f9;
        }
        
        .recommendations-skeleton-header {
          height: 24px;
          width: 180px;
          background-color: #e0e0e0;
          border-radius: 4px;
          animation: pulse 1.5s infinite;
        }
        
        .recommendations-skeleton-items {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        
        .recommendation-skeleton-item {
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-radius: 8px;
          background-color: white;
          padding: 12px;
          animation: pulse 1.5s infinite;
        }
        
        .recommendation-skeleton-image {
          width: 100%;
          height: 140px;
          background-color: #e0e0e0;
          border-radius: 4px;
        }
        
        .recommendation-skeleton-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .recommendation-skeleton-title {
          height: 16px;
          width: 100%;
          background-color: #e0e0e0;
          border-radius: 4px;
        }
        
        .recommendation-skeleton-price {
          height: 14px;
          width: 60%;
          background-color: #e0e0e0;
          border-radius: 4px;
        }
        
        .recommendation-skeleton-rating {
          height: 12px;
          width: 80%;
          background-color: #e0e0e0;
          border-radius: 4px;
        }
        
        @keyframes pulse {
          0% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}

// Error state
function RecommendationsError({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="recommendations-error">
      <h3>Error Loading Recommendations</h3>
      <p>{error.message}</p>
      <button onClick={retry}>Retry</button>
      <style jsx>{`
        .recommendations-error {
          padding: 20px;
          border-radius: 8px;
          background-color: #ffecec;
          border: 1px solid #f5c2c2;
          color: #d8000c;
        }
        
        h3 {
          margin-top: 0;
        }
        
        button {
          background-color: #d8000c;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }
        
        button:hover {
          background-color: #b50006;
        }
      `}</style>
    </div>
  );
}

// Recommendation item
function RecommendationItem({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="recommendation-item">
      <div className="recommendation-image">
        <img src={recommendation.image} alt={recommendation.name} />
      </div>
      <div className="recommendation-content">
        <h4 className="recommendation-name">{recommendation.name}</h4>
        <div className="recommendation-category">{recommendation.category}</div>
        <div className="recommendation-price">{formatCurrency(recommendation.price)}</div>
        <div className="recommendation-rating">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={`star ${i < Math.floor(recommendation.rating) ? 'filled' : ''}`}>
              ★
            </span>
          ))}
          <span className="rating-value">{recommendation.rating.toFixed(1)}</span>
        </div>
      </div>
      <style jsx>{`
        .recommendation-item {
          display: flex;
          flex-direction: column;
          border-radius: 8px;
          background-color: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .recommendation-item:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }
        
        .recommendation-image {
          width: 100%;
          height: 160px;
          overflow: hidden;
        }
        
        .recommendation-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s;
        }
        
        .recommendation-item:hover .recommendation-image img {
          transform: scale(1.05);
        }
        
        .recommendation-content {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .recommendation-name {
          margin: 0;
          font-size: 16px;
          font-weight: bold;
          color: #333;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .recommendation-category {
          font-size: 12px;
          color: #757575;
          text-transform: uppercase;
        }
        
        .recommendation-price {
          font-size: 16px;
          font-weight: bold;
          color: #2e7d32;
          margin: 4px 0;
        }
        
        .recommendation-rating {
          display: flex;
          align-items: center;
        }
        
        .star {
          color: #e0e0e0;
          font-size: 14px;
        }
        
        .star.filled {
          color: #ffc107;
        }
        
        .rating-value {
          margin-left: 4px;
          font-size: 12px;
          color: #757575;
        }
      `}</style>
    </div>
  );
}

// Recommendations display
function RecommendationsDisplay({ recommendations }: { recommendations: Recommendation[] }) {
  return (
    <div className="recommendations-section">
      <h3 className="recommendations-title">Recommended for You</h3>
      
      {recommendations.length === 0 ? (
        <div className="no-recommendations">
          No recommendations available at this time.
        </div>
      ) : (
        <div className="recommendations-grid">
          {recommendations.map(recommendation => (
            <RecommendationItem 
              key={recommendation.id} 
              recommendation={recommendation} 
            />
          ))}
        </div>
      )}
      
      <style jsx>{`
        .recommendations-section {
          padding: 20px;
          background-color: #f9f9f9;
          border-radius: 8px;
        }
        
        .recommendations-title {
          margin-top: 0;
          margin-bottom: 20px;
          font-size: 20px;
          color: #333;
        }
        
        .no-recommendations {
          padding: 20px;
          background-color: white;
          border-radius: 8px;
          color: #757575;
          text-align: center;
          font-style: italic;
        }
        
        .recommendations-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        
        @media (max-width: 600px) {
          .recommendations-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

// Data fetching component
function RecommendationsData({
  userId,
  productId,
  limit = 5,
  priority = 'medium'
}: RecommendationsStreamProps) {
  // Calculate delay based on priority
  const delay = FETCH_DELAYS[priority];
  
  // Fetch recommendations with artificial delay
  const recommendationsPromise = fetchRecommendations({ 
    userId, 
    productId,
    limit,
    delay 
  });
  
  // Suspense will catch this promise
  const recommendations = use(recommendationsPromise);
  
  return <RecommendationsDisplay recommendations={recommendations} />;
}

// React 18 use hook for client
function use<T>(promise: Promise<T>): T {
  if (promise.status === 'fulfilled') {
    return promise.value;
  } else if (promise.status === 'rejected') {
    throw promise.reason;
  } else {
    throw promise;
  }
}

// Augment Promise type
declare global {
  interface Promise<T> {
    status?: 'pending' | 'fulfilled' | 'rejected';
    value?: T;
    reason?: any;
  }
}

// Main component with error boundaries
export default function RecommendationsStream({
  userId,
  productId,
  limit = 5,
  priority = 'medium'
}: RecommendationsStreamProps) {
  const [key, setKey] = React.useState(0);
  const [error, setError] = React.useState<Error | null>(null);
  
  // Handle errors
  const handleError = (error: Error) => {
    setError(error);
  };
  
  // Retry loading
  const handleRetry = () => {
    setError(null);
    setKey(prevKey => prevKey + 1);
  };
  
  // If there's an error, show error UI
  if (error) {
    return <RecommendationsError error={error} retry={handleRetry} />;
  }
  
  // Ensure either userId or productId is provided
  if (!userId && !productId) {
    return (
      <div className="recommendations-error">
        <p>Error: Either userId or productId is required for recommendations.</p>
        <style jsx>{`
          .recommendations-error {
            padding: 20px;
            border-radius: 8px;
            background-color: #ffecec;
            color: #d8000c;
          }
          
          p {
            margin: 0;
          }
        `}</style>
      </div>
    );
  }
  
  // Streaming recommendations with skeleton fallback
  return (
    <Suspense fallback={<RecommendationsSkeleton />}>
      <RecommendationsData 
        key={key}
        userId={userId}
        productId={productId}
        limit={limit}
        priority={priority}
      />
    </Suspense>
  );
}