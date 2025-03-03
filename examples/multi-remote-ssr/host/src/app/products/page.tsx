'use client';

import React, { useState, useEffect } from 'react';
import { useSharedContext, useRemoteComponent } from 'multi-remote-ssr-shared/context';
import { Product } from 'remote-b/ProductCard';

// Dynamically import remote components
const ProductList = React.lazy(() => import('remote-b/ProductList'));
const ProductCard = React.lazy(() => import('remote-b/ProductCard'));
const ContentBlock = React.lazy(() => import('remote-b/ContentBlock'));
const Loading = React.lazy(() => import('remote-c/Loading'));
const Notification = React.lazy(() => import('remote-c/Notification'));

// Extended product data for product catalog
const productCatalog: Product[] = [
  {
    id: '1',
    name: 'Premium Widget',
    description: 'A high-quality widget with advanced features for professional use. Includes extended warranty and premium support.',
    price: 49.99,
    imageUrl: 'https://via.placeholder.com/150',
    inStock: true,
  },
  {
    id: '2',
    name: 'Basic Gadget',
    description: 'An affordable gadget for everyday use. Perfect for beginners and casual users.',
    price: 19.99,
    imageUrl: 'https://via.placeholder.com/150',
    inStock: true,
  },
  {
    id: '3',
    name: 'Luxury Item',
    description: 'The ultimate luxury item with premium features. Limited edition with exclusive design elements.',
    price: 149.99,
    imageUrl: 'https://via.placeholder.com/150',
    inStock: false,
  },
  {
    id: '4',
    name: 'Everyday Tool',
    description: 'A reliable tool for everyday tasks. Durable construction and ergonomic design.',
    price: 29.99,
    imageUrl: 'https://via.placeholder.com/150',
    inStock: true,
  },
  {
    id: '5',
    name: 'Professional Kit',
    description: 'Complete kit for professionals. Includes all necessary components and detailed documentation.',
    price: 89.99,
    imageUrl: 'https://via.placeholder.com/150',
    inStock: true,
  },
  {
    id: '6',
    name: 'Smart Device',
    description: 'Internet-connected device with advanced features. Compatible with all major smart home systems.',
    price: 59.99,
    imageUrl: 'https://via.placeholder.com/150',
    inStock: true,
  },
  {
    id: '7',
    name: 'Budget Option',
    description: 'Affordable option with essential features. Great value for money.',
    price: 14.99,
    imageUrl: 'https://via.placeholder.com/150',
    inStock: true,
  },
  {
    id: '8',
    name: 'Collector\'s Edition',
    description: 'Special collector\'s edition with unique design. Limited availability.',
    price: 199.99,
    imageUrl: 'https://via.placeholder.com/150',
    inStock: false,
  },
];

export default function ProductsPage() {
  // State for managing UI elements
  const [isLoading, setIsLoading] = useState(true);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(productCatalog);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [currentFilter, setCurrentFilter] = useState<Record<string, any>>({});
  const [currentSort, setCurrentSort] = useState<string>('name');
  
  // Get shared context and remote component state
  const [sharedContext] = useSharedContext();
  const [catalogState, updateCatalogState] = useRemoteComponent('remote-b', 'products-catalog', {
    filterOptions: {
      inStock: true,
      priceRange: { min: 0, max: 200 },
    },
    sortOptions: ['name', 'price-low', 'price-high'],
    viewMode: 'grid',
  });
  
  // Simulate data loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Handle adding products to cart
  const handleAddToCart = (product: Product) => {
    setNotificationType('success');
    setNotificationMessage(`Added ${product.name} to cart!`);
    setShowNotification(true);
    
    setTimeout(() => {
      setShowNotification(false);
    }, 3000);
  };
  
  // Handle filter changes
  const handleFilterChange = (filters: Record<string, any>) => {
    setCurrentFilter(filters);
    updateCatalogState({ filterOptions: filters });
    
    // Apply filters to products
    let filtered = [...productCatalog];
    
    if (filters.inStock) {
      filtered = filtered.filter(product => product.inStock);
    }
    
    if (filters.priceRange) {
      filtered = filtered.filter(product => 
        product.price >= filters.priceRange.min && 
        product.price <= filters.priceRange.max
      );
    }
    
    setFilteredProducts(filtered);
  };
  
  // Handle sort changes
  const handleSortChange = (sortBy: string) => {
    setCurrentSort(sortBy);
    updateCatalogState({ sortBy });
    
    // Apply sorting to products
    let sorted = [...filteredProducts];
    
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'price-low':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        sorted.sort((a, b) => b.price - a.price);
        break;
      default:
        // Default sort by name
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    setFilteredProducts(sorted);
  };
  
  // Render content when loading is complete
  const renderContent = () => {
    return (
      <>
        <div className="catalog-header">
          <React.Suspense fallback={<div>Loading content...</div>}>
            <ContentBlock
              id="catalog-intro"
              title="Product Catalog"
              content={
                <div>
                  <p>Browse our selection of products. Use the filters and sorting options to find exactly what you need.</p>
                  <p>Current theme: <strong>{sharedContext.theme}</strong></p>
                </div>
              }
              variant="default"
            />
          </React.Suspense>
        </div>
        
        <div className="catalog-filters">
          <div className="filter-controls">
            <div className="filter-group">
              <label>
                <input 
                  type="checkbox" 
                  checked={currentFilter.inStock} 
                  onChange={() => handleFilterChange({
                    ...currentFilter,
                    inStock: !currentFilter.inStock
                  })}
                />
                In Stock Only
              </label>
            </div>
            
            <div className="filter-group">
              <label>Price Range:</label>
              <select 
                value={
                  currentFilter.priceRange ? 
                  `${currentFilter.priceRange.min}-${currentFilter.priceRange.max}` : 
                  "0-200"
                }
                onChange={(e) => {
                  const [min, max] = e.target.value.split('-').map(Number);
                  handleFilterChange({
                    ...currentFilter,
                    priceRange: { min, max }
                  });
                }}
              >
                <option value="0-200">All Prices</option>
                <option value="0-25">Under $25</option>
                <option value="25-50">$25 to $50</option>
                <option value="50-100">$50 to $100</option>
                <option value="100-200">Over $100</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label>Sort By:</label>
              <select 
                value={currentSort}
                onChange={(e) => handleSortChange(e.target.value)}
              >
                <option value="name">Name</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="products-container">
          <React.Suspense fallback={<div>Loading products...</div>}>
            <ProductList 
              products={filteredProducts} 
              onAddToCart={handleAddToCart}
              onFilterChange={handleFilterChange}
              onSortChange={handleSortChange}
            />
          </React.Suspense>
        </div>
        
        {/* Featured product */}
        <div className="featured-product">
          <h2>Featured Product</h2>
          <React.Suspense fallback={<div>Loading featured product...</div>}>
            <ProductCard 
              product={productCatalog[4]} // Professional Kit
              onAddToCart={handleAddToCart}
            />
          </React.Suspense>
        </div>
        
        {/* Notification component */}
        {showNotification && (
          <React.Suspense fallback={null}>
            <Notification
              type={notificationType}
              message={notificationMessage}
              duration={3000}
              onClose={() => setShowNotification(false)}
            />
          </React.Suspense>
        )}
      </>
    );
  };
  
  return (
    <div className={`products-page ${sharedContext.theme}`}>
      {isLoading ? (
        <React.Suspense fallback={<div>Loading...</div>}>
          <Loading type="spinner" size="large" text="Loading product catalog..." />
        </React.Suspense>
      ) : (
        renderContent()
      )}
      
      {/* Add component-specific styling */}
      <style jsx>{`
        .products-page {
          transition: background-color 0.3s ease;
          padding: 1rem 0;
        }
        
        .products-page.dark {
          background-color: #333;
          color: #f0f0f0;
        }
        
        .catalog-header {
          margin-bottom: 2rem;
        }
        
        .catalog-filters {
          margin-bottom: 2rem;
          padding: 1rem;
          background-color: ${sharedContext.theme === 'dark' ? '#444' : '#f0f0f0'};
          border-radius: 4px;
        }
        
        .filter-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
        }
        
        .filter-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .filter-group select {
          padding: 0.5rem;
          border-radius: 4px;
          border: 1px solid ${sharedContext.theme === 'dark' ? '#666' : '#ccc'};
          background-color: ${sharedContext.theme === 'dark' ? '#555' : 'white'};
          color: ${sharedContext.theme === 'dark' ? 'white' : 'black'};
        }
        
        .products-container {
          margin-bottom: 2rem;
        }
        
        .featured-product {
          margin-top: 3rem;
          padding: 1.5rem;
          border-top: 1px solid var(--primary-color);
        }
        
        .featured-product h2 {
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
}