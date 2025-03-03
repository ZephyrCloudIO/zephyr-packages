'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useFederation } from 'hybrid-ssr-csr-shared/dist/federation-context';
import { Product, SortOption } from 'hybrid-ssr-csr-shared/dist/types';
import { filterProductsByCategory, sortProducts } from 'hybrid-ssr-csr-shared/dist/utils';
import ErrorBoundary from '../../components/ErrorBoundary';
import LoadingFallback from '../../components/LoadingFallback';

// Lazy-load the client product component
const ClientProduct = dynamic(() => import('csrRemote/ClientProduct'), {
  loading: () => <LoadingFallback type="skeleton" />,
  ssr: false
});

// Import server components via next/dynamic for client pages
const ServerHeader = dynamic(() => import('ssrRemote/ServerHeader'), {
  loading: () => <LoadingFallback type="skeleton" />,
  ssr: true // This will be server-rendered
});

const ProductsPage: React.FC = () => {
  const { themeMode, addToCart } = useFederation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [error, setError] = useState<string | null>(null);

  // Categories for filtering
  const categories = ['all', 'electronics', 'clothing', 'books', 'home'];

  // Fetch products (simulated)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        
        // Simulate API call with timeout
        setTimeout(() => {
          // Mock data
          const mockProducts: Product[] = Array.from({ length: 8 }, (_, i) => ({
            id: `product-${i + 1}`,
            name: `Product ${i + 1}`,
            description: `This is a ${
              i % 4 === 0 ? 'high-quality electronics' : 
              i % 4 === 1 ? 'stylish clothing' : 
              i % 4 === 2 ? 'bestselling book' : 
              'premium home'
            } product with great features.`,
            price: 9.99 + (i * 10),
            image: `https://via.placeholder.com/300x200?text=Product+${i + 1}`,
            category: i % 4 === 0 ? 'electronics' : 
                     i % 4 === 1 ? 'clothing' : 
                     i % 4 === 2 ? 'books' : 'home',
            inStock: i % 3 !== 0
          }));
          
          setProducts(mockProducts);
          setLoading(false);
        }, 1000);
      } catch (err) {
        setError('Failed to load products. Please try again later.');
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Filter and sort products
  const filteredProducts = filterProductsByCategory(products, category);
  const sortedProducts = sortProducts(filteredProducts, sortBy);

  // Handle adding to cart
  const handleAddToCart = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      addToCart({
        ...product,
        quantity: 1
      });
    }
  };

  return (
    <div className="products-page">
      {/* Server-rendered header */}
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback type="skeleton" />}>
          <ServerHeader 
            title="Products" 
            subtitle="Browse our collection of products"
            themeMode={themeMode}
          />
        </Suspense>
      </ErrorBoundary>
      
      {/* Client-side filters */}
      <div className="filters-container">
        <div className="category-filter">
          <label htmlFor="category">Category:</label>
          <select 
            id="category" 
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="sort-filter">
          <label htmlFor="sort">Sort by:</label>
          <select 
            id="sort" 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="name">Name (A-Z)</option>
            <option value="price-low">Price (Low to High)</option>
            <option value="price-high">Price (High to Low)</option>
          </select>
        </div>
      </div>
      
      {/* Products grid */}
      {loading ? (
        <div className="loading-container">
          <LoadingFallback type="spinner" message="Loading products..." />
        </div>
      ) : error ? (
        <div className="error-container">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="no-products">
          <p>No products found in this category.</p>
        </div>
      ) : (
        <div className="products-grid">
          {sortedProducts.map(product => (
            <ErrorBoundary key={product.id}>
              <Suspense fallback={<LoadingFallback type="skeleton" />}>
                <ClientProduct
                  id={product.id}
                  name={product.name}
                  description={product.description}
                  price={product.price}
                  image={product.image}
                  onAddToCart={handleAddToCart}
                />
              </Suspense>
            </ErrorBoundary>
          ))}
        </div>
      )}
      
      <style jsx>{`
        .products-page {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .filters-container {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          padding: 15px;
          background-color: var(--color-background-alt);
          border-radius: var(--border-radius);
          box-shadow: var(--box-shadow);
        }
        
        .category-filter,
        .sort-filter {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        label {
          font-weight: bold;
          color: var(--color-text);
        }
        
        select {
          padding: 8px 12px;
          border: 1px solid var(--color-border);
          border-radius: 4px;
          background-color: var(--color-background);
          color: var(--color-text);
          font-size: 14px;
        }
        
        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }
        
        .loading-container,
        .error-container,
        .no-products {
          padding: 40px;
          text-align: center;
          background-color: var(--color-background-alt);
          border-radius: var(--border-radius);
          margin: 20px 0;
        }
        
        .error-container button {
          margin-top: 15px;
          padding: 8px 16px;
          background-color: var(--color-primary);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        @media (max-width: 768px) {
          .filters-container {
            flex-direction: column;
            gap: 15px;
          }
          
          .products-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default ProductsPage;