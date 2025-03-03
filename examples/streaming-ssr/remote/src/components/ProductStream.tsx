import React, { Suspense } from 'react';
import { Product, StreamingPriority } from 'streaming-ssr-shared/dist/types';
import { fetchProduct } from 'streaming-ssr-shared/dist/data';
import { formatCurrency } from 'streaming-ssr-shared/dist/utils';
import { getPriorityDeferTime } from 'streaming-ssr-shared/dist/streaming';

// Simulated fetch delay based on priority
const FETCH_DELAYS: Record<StreamingPriority, number> = {
  critical: 100,
  high: 1000,
  medium: 2000,
  low: 3000
};

interface ProductStreamProps {
  productId: string;
  initialData?: Product; // For SSR preloaded data
  priority?: StreamingPriority;
}

// Loading state
function ProductSkeleton() {
  return (
    <div className="product-skeleton">
      <div className="product-skeleton-image"></div>
      <div className="product-skeleton-content">
        <div className="product-skeleton-title"></div>
        <div className="product-skeleton-price"></div>
        <div className="product-skeleton-description"></div>
        <div className="product-skeleton-specs"></div>
      </div>
      <style jsx>{`
        .product-skeleton {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 20px;
          border-radius: 8px;
          background-color: #f9f9f9;
          animation: pulse 1.5s infinite;
        }
        
        .product-skeleton-image {
          width: 100%;
          height: 250px;
          background-color: #e0e0e0;
          border-radius: 4px;
        }
        
        .product-skeleton-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .product-skeleton-title {
          height: 24px;
          width: 80%;
          background-color: #e0e0e0;
          border-radius: 4px;
        }
        
        .product-skeleton-price {
          height: 20px;
          width: 40%;
          background-color: #e0e0e0;
          border-radius: 4px;
        }
        
        .product-skeleton-description {
          height: 80px;
          width: 100%;
          background-color: #e0e0e0;
          border-radius: 4px;
        }
        
        .product-skeleton-specs {
          height: 60px;
          width: 100%;
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
function ProductError({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="product-error">
      <h3>Error Loading Product</h3>
      <p>{error.message}</p>
      <button onClick={retry}>Retry</button>
      <style jsx>{`
        .product-error {
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

// Actual product display
function ProductDisplay({ product }: { product: Product }) {
  return (
    <div className="product">
      <div className="product-header">
        <h2 className="product-name">{product.name}</h2>
        {product.inStock ? (
          <span className="product-badge in-stock">In Stock</span>
        ) : (
          <span className="product-badge out-of-stock">Out of Stock</span>
        )}
      </div>
      
      <div className="product-rating">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={`star ${i < Math.floor(product.rating) ? 'filled' : ''}`}>
            ★
          </span>
        ))}
        <span className="rating-value">{product.rating.toFixed(1)}</span>
        <span className="reviews-count">({product.reviews} reviews)</span>
      </div>
      
      <div className="product-images">
        {product.images.map((image, index) => (
          <img key={index} src={image} alt={`${product.name} - Image ${index + 1}`} />
        ))}
      </div>
      
      <div className="product-price">
        {formatCurrency(product.price)}
        {product.price > 100 && (
          <span className="price-installment">
            or {formatCurrency(product.price / 4)} × 4 installments
          </span>
        )}
      </div>
      
      <p className="product-description">{product.description}</p>
      
      <div className="product-specifications">
        <h3>Specifications</h3>
        <table>
          <tbody>
            {Object.entries(product.specifications).map(([key, value]) => (
              <tr key={key}>
                <td className="spec-name">{key}</td>
                <td className="spec-value">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="product-actions">
        <button className="add-to-cart-button">
          Add to Cart
        </button>
        <button className="wishlist-button">
          Add to Wishlist
        </button>
      </div>
      
      <style jsx>{`
        .product {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 20px;
          border-radius: 8px;
          background-color: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .product-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .product-name {
          margin: 0;
          font-size: 24px;
          color: #333;
        }
        
        .product-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }
        
        .in-stock {
          background-color: #e6f7e6;
          color: #2e7d32;
        }
        
        .out-of-stock {
          background-color: #fdecea;
          color: #c62828;
        }
        
        .product-rating {
          display: flex;
          align-items: center;
        }
        
        .star {
          color: #e0e0e0;
          font-size: 18px;
        }
        
        .star.filled {
          color: #ffc107;
        }
        
        .rating-value {
          margin-left: 8px;
          font-weight: bold;
        }
        
        .reviews-count {
          margin-left: 4px;
          color: #757575;
          font-size: 14px;
        }
        
        .product-images {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding: 10px 0;
        }
        
        .product-images img {
          width: 150px;
          height: 150px;
          object-fit: cover;
          border-radius: 4px;
        }
        
        .product-price {
          font-size: 24px;
          font-weight: bold;
          color: #2e7d32;
        }
        
        .price-installment {
          margin-left: 10px;
          font-size: 14px;
          font-weight: normal;
          color: #757575;
        }
        
        .product-description {
          font-size: 16px;
          line-height: 1.5;
          color: #424242;
        }
        
        .product-specifications h3 {
          margin-top: 0;
          margin-bottom: 10px;
          font-size: 18px;
        }
        
        .product-specifications table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .product-specifications tr:nth-child(even) {
          background-color: #f5f5f5;
        }
        
        .product-specifications td {
          padding: 8px;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .spec-name {
          font-weight: bold;
          width: 30%;
        }
        
        .product-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        
        .add-to-cart-button {
          flex: 1;
          padding: 12px;
          background-color: #1976d2;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        
        .add-to-cart-button:hover {
          background-color: #1565c0;
        }
        
        .wishlist-button {
          padding: 12px;
          background-color: white;
          color: #1976d2;
          border: 1px solid #1976d2;
          border-radius: 4px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
        }
        
        .wishlist-button:hover {
          background-color: #f5f5f5;
        }
      `}</style>
    </div>
  );
}

// Data fetching component
function ProductData({ 
  productId, 
  initialData,
  priority = 'medium'
}: ProductStreamProps) {
  // If we already have data (SSR), use it
  if (initialData) {
    return <ProductDisplay product={initialData} />;
  }
  
  // Calculate delay based on priority
  const delay = FETCH_DELAYS[priority];
  
  // Fetch with artificial delay
  const productPromise = fetchProduct(productId, { delay });
  
  // Suspense will catch this promise
  const product = use(productPromise);
  
  return <ProductDisplay product={product} />;
}

// React 18 use hook for client (not needed in latest Next.js)
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
export default function ProductStream({
  productId,
  initialData,
  priority = 'medium'
}: ProductStreamProps) {
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
    return <ProductError error={error} retry={handleRetry} />;
  }
  
  // Streaming product display with skeleton as fallback
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductData 
        key={key}
        productId={productId}
        initialData={initialData}
        priority={priority}
      />
    </Suspense>
  );
}