'use client';

import React from 'react';
import { 
  useRemoteComponent, 
  useSharedContext,
  createComponentId 
} from 'multi-remote-ssr-shared';

export interface ProductData {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  rating: number;
  inStock: boolean;
}

interface ProductCardProps {
  id?: string;
  product: ProductData;
  onAddToCart?: (productId: string) => void;
}

export default function ProductCard({ 
  id = createComponentId('product'),
  product,
  onAddToCart
}: ProductCardProps) {
  // Use the remote component state management
  const [state, setState] = useRemoteComponent('remote_b', id, {
    inCart: false,
    quantity: 0,
  });
  
  // Get shared context (like theme)
  const [sharedContext] = useSharedContext();
  const theme = sharedContext.theme || 'light';
  
  // Handle add to cart action
  const handleAddToCart = () => {
    const newQuantity = state.quantity + 1;
    setState({ 
      inCart: true,
      quantity: newQuantity,
    });
    
    if (onAddToCart) {
      onAddToCart(product.id);
    }
  };
  
  // Calculate discount based on user permissions
  const hasDiscountPermission = sharedContext.permissions?.includes('discount');
  const discountedPrice = hasDiscountPermission ? product.price * 0.9 : product.price;
  
  // Styles based on theme
  const styles = {
    card: {
      border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
      borderRadius: '8px',
      padding: '16px',
      width: '100%',
      maxWidth: '320px',
      backgroundColor: theme === 'dark' ? '#333' : 'white',
      color: theme === 'dark' ? '#fff' : '#333',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column' as const,
      position: 'relative' as const,
    },
    imageContainer: {
      width: '100%',
      height: '160px',
      borderRadius: '4px',
      overflow: 'hidden',
      marginBottom: '12px',
      backgroundColor: theme === 'dark' ? '#222' : '#f5f5f5',
    },
    image: {
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
    },
    title: {
      fontSize: '18px',
      fontWeight: 'bold',
      margin: '0 0 8px 0',
    },
    description: {
      fontSize: '14px',
      color: theme === 'dark' ? '#ccc' : '#666',
      margin: '0 0 12px 0',
      lineHeight: '1.4',
    },
    priceRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px',
    },
    price: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: hasDiscountPermission ? (theme === 'dark' ? '#88ff88' : '#2e7d32') : undefined,
    },
    originalPrice: {
      textDecoration: 'line-through',
      marginRight: '8px',
      color: theme === 'dark' ? '#999' : '#999',
      fontSize: '14px',
    },
    badge: {
      position: 'absolute' as const,
      top: '10px',
      right: '10px',
      backgroundColor: product.inStock ? '#4caf50' : '#f44336',
      color: 'white',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold',
    },
    buttonRow: {
      display: 'flex',
      gap: '8px',
      marginTop: 'auto',
    },
    button: {
      padding: '8px 16px',
      borderRadius: '4px',
      border: 'none',
      fontWeight: 'bold',
      cursor: product.inStock ? 'pointer' : 'not-allowed',
      backgroundColor: product.inStock 
        ? (theme === 'dark' ? '#5C6BC0' : '#3f51b5') 
        : (theme === 'dark' ? '#666' : '#ccc'),
      color: 'white',
      opacity: product.inStock ? 1 : 0.7,
      flex: 1,
    },
    counter: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px',
      borderRadius: '4px',
      backgroundColor: theme === 'dark' ? '#444' : '#f0f0f0',
      width: '40px',
    },
    rating: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: '12px',
      color: theme === 'dark' ? '#ffc107' : '#ff9800',
      fontSize: '14px',
    },
    hydrationBadge: {
      position: 'absolute' as const,
      top: -8,
      right: -8,
      padding: '2px 6px',
      backgroundColor: '#00aa44',
      color: 'white',
      fontSize: '10px',
      borderRadius: '4px',
      zIndex: 10,
    },
  };
  
  // Generate star rating
  const starRating = Array(5).fill(0).map((_, index) => (
    <span key={index} style={{ color: index < product.rating ? '#ffc107' : '#e0e0e0' }}>★</span>
  ));
  
  return (
    <div style={styles.card}>
      {state.hydrated && (
        <div style={styles.hydrationBadge}>✓ Hydrated</div>
      )}
      
      <div style={styles.badge}>
        {product.inStock ? 'In Stock' : 'Out of Stock'}
      </div>
      
      <div style={styles.imageContainer}>
        <img 
          src={product.image} 
          alt={product.name}
          style={styles.image}
          loading="lazy"
        />
      </div>
      
      <h3 style={styles.title}>{product.name}</h3>
      
      <div style={styles.rating}>
        {starRating} <span style={{ marginLeft: '4px' }}>({product.rating})</span>
      </div>
      
      <p style={styles.description}>{product.description}</p>
      
      <div style={styles.priceRow}>
        <div>
          {hasDiscountPermission && (
            <span style={styles.originalPrice}>${product.price.toFixed(2)}</span>
          )}
          <span style={styles.price}>${discountedPrice.toFixed(2)}</span>
        </div>
        
        {state.inCart && (
          <div style={styles.counter}>{state.quantity}</div>
        )}
      </div>
      
      <div style={styles.buttonRow}>
        <button 
          style={styles.button}
          onClick={handleAddToCart}
          disabled={!product.inStock}
        >
          {state.inCart ? 'Add More' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}