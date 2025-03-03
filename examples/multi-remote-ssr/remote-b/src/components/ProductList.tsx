'use client';

import React, { useState } from 'react';
import { 
  useRemoteComponent, 
  useSharedContext,
  createComponentId 
} from 'multi-remote-ssr-shared';
import ProductCard, { ProductData } from './ProductCard';

interface ProductListProps {
  id?: string;
  products: ProductData[];
  title?: string;
}

export default function ProductList({ 
  id = createComponentId('productList'),
  products,
  title = 'Products'
}: ProductListProps) {
  // Use the remote component state management
  const [state, setState] = useRemoteComponent('remote_b', id, {
    sortBy: 'default',
    cartItems: 0,
    filterInStock: false,
  });
  
  // Get shared context (like theme)
  const [sharedContext] = useSharedContext();
  const theme = sharedContext.theme || 'light';
  
  // Handle sorting change
  const handleSortChange = (sortBy: string) => {
    setState({ sortBy });
  };
  
  // Handle filter change
  const handleFilterChange = () => {
    setState({ filterInStock: !state.filterInStock });
  };
  
  // Handle add to cart
  const handleAddToCart = (productId: string) => {
    setState({ cartItems: state.cartItems + 1 });
  };
  
  // Apply sorting and filtering
  const filteredProducts = products
    .filter(product => !state.filterInStock || product.inStock)
    .sort((a, b) => {
      switch (state.sortBy) {
        case 'price-low-high':
          return a.price - b.price;
        case 'price-high-low':
          return b.price - a.price;
        case 'rating':
          return b.rating - a.rating;
        default:
          return 0; // Keep original order
      }
    });
  
  // Styles based on theme
  const styles = {
    container: {
      padding: '20px',
      backgroundColor: theme === 'dark' ? '#222' : '#f9f9f9',
      borderRadius: '8px',
      color: theme === 'dark' ? '#fff' : '#333',
      position: 'relative' as const,
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      flexWrap: 'wrap' as const,
      gap: '10px',
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    controls: {
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
      flexWrap: 'wrap' as const,
    },
    select: {
      padding: '8px 12px',
      borderRadius: '4px',
      border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
      backgroundColor: theme === 'dark' ? '#333' : 'white',
      color: theme === 'dark' ? '#fff' : '#333',
      fontSize: '14px',
    },
    filterButton: {
      padding: '8px 12px',
      borderRadius: '4px',
      border: 'none',
      backgroundColor: state.filterInStock 
        ? (theme === 'dark' ? '#5C6BC0' : '#3f51b5')
        : (theme === 'dark' ? '#444' : '#e0e0e0'),
      color: 'white',
      cursor: 'pointer',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    productsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '20px',
    },
    cartBadge: {
      backgroundColor: theme === 'dark' ? '#4CAF50' : '#2e7d32',
      color: 'white',
      borderRadius: '50%',
      width: '24px',
      height: '24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      marginLeft: '8px',
    },
    noProducts: {
      padding: '20px',
      textAlign: 'center' as const,
      backgroundColor: theme === 'dark' ? '#333' : '#f5f5f5',
      borderRadius: '8px',
      marginTop: '20px',
    },
    remoteInfo: {
      display: 'inline-block',
      padding: '4px 8px',
      backgroundColor: theme === 'dark' ? '#443366' : '#f0e6ff',
      color: theme === 'dark' ? '#bb99ff' : '#6200ea',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold',
      marginRight: '10px',
    },
    hydrationBadge: {
      position: 'absolute' as const,
      top: 5,
      right: 5,
      padding: '2px 6px',
      backgroundColor: '#00aa44',
      color: 'white',
      fontSize: '10px',
      borderRadius: '4px',
    },
  };
  
  return (
    <div style={styles.container}>
      {state.hydrated && (
        <div style={styles.hydrationBadge}>✓ Hydrated</div>
      )}
      
      <div style={styles.header}>
        <h2 style={styles.title}>
          <span style={styles.remoteInfo}>Remote B</span>
          {title}
          {state.cartItems > 0 && (
            <div style={styles.cartBadge}>{state.cartItems}</div>
          )}
        </h2>
        
        <div style={styles.controls}>
          <select 
            style={styles.select}
            value={state.sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            aria-label="Sort products"
          >
            <option value="default">Default Sorting</option>
            <option value="price-low-high">Price: Low to High</option>
            <option value="price-high-low">Price: High to Low</option>
            <option value="rating">Rating</option>
          </select>
          
          <button
            style={styles.filterButton}
            onClick={handleFilterChange}
            aria-pressed={state.filterInStock}
          >
            <span>{state.filterInStock ? '✓' : '☐'}</span> In Stock Only
          </button>
        </div>
      </div>
      
      {filteredProducts.length > 0 ? (
        <div style={styles.productsGrid}>
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              id={`${id}_product_${product.id}`}
              product={product}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>
      ) : (
        <div style={styles.noProducts}>
          <p>No products match your criteria. Please try changing your filters.</p>
        </div>
      )}
    </div>
  );
}