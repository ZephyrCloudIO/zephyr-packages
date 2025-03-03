// This is a Server Component
import React from 'react';
import { Product } from 'hybrid-ssr-csr-shared/dist/types';
import { formatCurrency } from 'hybrid-ssr-csr-shared/dist/utils';

interface ServerProductProps {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  category?: string;
  inStock?: boolean;
}

// Since this is a Server Component, it cannot:
// - Use state or refs
// - Use browser-only APIs
// - Use event handlers
// It CAN:
// - Fetch data
// - Access backend resources
// - Generate static HTML

const ServerProduct: React.FC<ServerProductProps> = ({
  id,
  name,
  description,
  price,
  image = '/placeholder-product.jpg',
  category = 'uncategorized',
  inStock = true,
}) => {
  // In a real application, you might fetch additional data here
  // Since this is a server component, this fetch won't happen on the client

  return (
    <div className="server-product">
      <div className="server-product-image-container">
        <img 
          src={image} 
          alt={name} 
          className="server-product-image"
        />
        {!inStock && (
          <div className="out-of-stock-badge">Out of Stock</div>
        )}
      </div>
      <div className="server-product-info">
        <h3 className="server-product-name">{name}</h3>
        <div className="server-product-category">{category}</div>
        <p className="server-product-description">{description}</p>
        <div className="server-product-price">
          {formatCurrency(price)}
        </div>
        {/* Note: No interactive elements here as this is a server component */}
        {/* Client components will add interactivity */}
        <div className="server-product-id">Product ID: {id}</div>
      </div>
      <style jsx>{`
        .server-product {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          background-color: #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .server-product-image-container {
          position: relative;
          margin-bottom: 12px;
        }
        
        .server-product-image {
          width: 100%;
          height: auto;
          border-radius: 4px;
          object-fit: cover;
          aspect-ratio: 4/3;
        }
        
        .out-of-stock-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          background-color: rgba(244, 67, 54, 0.9);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }
        
        .server-product-info {
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }
        
        .server-product-name {
          font-size: 18px;
          font-weight: bold;
          margin: 0 0 8px 0;
        }
        
        .server-product-category {
          font-size: 14px;
          color: #757575;
          margin-bottom: 8px;
          text-transform: capitalize;
        }
        
        .server-product-description {
          font-size: 14px;
          color: #424242;
          margin-bottom: 16px;
          flex-grow: 1;
        }
        
        .server-product-price {
          font-size: 18px;
          font-weight: bold;
          color: #4caf50;
          margin-bottom: 16px;
        }
        
        .server-product-id {
          font-size: 12px;
          color: #9e9e9e;
          margin-top: auto;
        }
      `}</style>
    </div>
  );
};

export default ServerProduct;