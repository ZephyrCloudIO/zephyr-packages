'use client';

import React, { useState, useEffect } from 'react';
import { useSharedContext } from 'multi-remote-ssr-shared/context';
import { Product } from 'remote-b/ProductCard';

// Dynamically import remote components
const ContentBlock = React.lazy(() => import('remote-b/ContentBlock'));
const ProductList = React.lazy(() => import('remote-b/ProductList'));
const Loading = React.lazy(() => import('remote-c/Loading'));
const Notification = React.lazy(() => import('remote-c/Notification'));
const Modal = React.lazy(() => import('remote-c/Modal'));

// Sample product data for demonstration
const sampleProducts: Product[] = [
  {
    id: '1',
    name: 'Premium Widget',
    description: 'A high-quality widget with advanced features',
    price: 49.99,
    imageUrl: 'https://via.placeholder.com/150',
    inStock: true,
  },
  {
    id: '2',
    name: 'Basic Gadget',
    description: 'An affordable gadget for everyday use',
    price: 19.99,
    imageUrl: 'https://via.placeholder.com/150',
    inStock: true,
  },
  {
    id: '3',
    name: 'Luxury Item',
    description: 'The ultimate luxury item with premium features',
    price: 149.99,
    imageUrl: 'https://via.placeholder.com/150',
    inStock: false,
  },
  {
    id: '4',
    name: 'Everyday Tool',
    description: 'A reliable tool for everyday tasks',
    price: 29.99,
    imageUrl: 'https://via.placeholder.com/150',
    inStock: true,
  },
];

export default function HomePage() {
  // State for managing UI elements
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [cartItems, setCartItems] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get shared context from Federation Provider
  const [sharedContext, updateSharedContext] = useSharedContext();
  
  // Simulate data loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Handle adding products to cart
  const handleAddToCart = (product: Product) => {
    setCartItems(prev => [...prev, product]);
    setNotificationType('success');
    setNotificationMessage(`Added ${product.name} to cart!`);
    setShowNotification(true);
    
    setTimeout(() => {
      setShowNotification(false);
    }, 3000);
  };
  
  // Toggle theme handler
  const toggleTheme = () => {
    const newTheme = sharedContext.theme === 'light' ? 'dark' : 'light';
    updateSharedContext({ theme: newTheme });
  };
  
  // Render content when loading is complete
  const renderContent = () => {
    return (
      <>
        <div className="welcome-section">
          <React.Suspense fallback={<div>Loading content...</div>}>
            <ContentBlock
              id="welcome"
              title="Welcome to our Multi-Remote SSR Demo"
              content={
                <div>
                  <p>This application demonstrates server-side rendering with multiple federated remotes.</p>
                  <p>Components from three different remotes are seamlessly integrated:</p>
                  <ul>
                    <li><strong>Remote A:</strong> Header, Navigation, and User Profile</li>
                    <li><strong>Remote B:</strong> Content Blocks and Product Listings</li>
                    <li><strong>Remote C:</strong> UI Utilities (Modals, Notifications, Loading)</li>
                  </ul>
                  <button 
                    className="theme-toggle-btn"
                    onClick={toggleTheme}
                  >
                    Toggle Theme ({sharedContext.theme})
                  </button>
                </div>
              }
              variant="highlighted"
            />
          </React.Suspense>
        </div>
        
        <div className="products-section">
          <h2>Featured Products</h2>
          <React.Suspense fallback={<div>Loading products...</div>}>
            <ProductList 
              products={sampleProducts} 
              onAddToCart={handleAddToCart}
            />
          </React.Suspense>
        </div>
        
        <div className="actions-section">
          <button 
            className="modal-btn"
            onClick={() => setIsModalOpen(true)}
          >
            View Cart ({cartItems.length} items)
          </button>
        </div>
        
        {/* Modal for cart */}
        {isModalOpen && (
          <React.Suspense fallback={<div>Loading modal...</div>}>
            <Modal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              title="Your Cart"
              size="medium"
            >
              {cartItems.length === 0 ? (
                <p>Your cart is empty.</p>
              ) : (
                <div className="cart-items">
                  {cartItems.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="cart-item">
                      <h4>{item.name}</h4>
                      <p>${item.price.toFixed(2)}</p>
                    </div>
                  ))}
                  <div className="cart-total">
                    <h3>Total: ${cartItems.reduce((sum, item) => sum + item.price, 0).toFixed(2)}</h3>
                  </div>
                  <button 
                    className="checkout-btn"
                    onClick={() => {
                      setIsModalOpen(false);
                      setCartItems([]);
                      setNotificationType('success');
                      setNotificationMessage('Order placed successfully!');
                      setShowNotification(true);
                      
                      setTimeout(() => {
                        setShowNotification(false);
                      }, 3000);
                    }}
                  >
                    Checkout
                  </button>
                </div>
              )}
            </Modal>
          </React.Suspense>
        )}
        
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
    <div className={`home-page ${sharedContext.theme}`}>
      {isLoading ? (
        <React.Suspense fallback={<div>Loading...</div>}>
          <Loading type="spinner" size="large" text="Loading content..." />
        </React.Suspense>
      ) : (
        renderContent()
      )}
      
      {/* Add component-specific styling */}
      <style jsx>{`
        .home-page {
          transition: background-color 0.3s ease;
        }
        
        .home-page.dark {
          background-color: #333;
          color: #f0f0f0;
        }
        
        .welcome-section {
          margin-bottom: 2rem;
        }
        
        .products-section {
          margin-bottom: 2rem;
        }
        
        .products-section h2 {
          margin-bottom: 1rem;
          border-bottom: 1px solid var(--primary-color);
          padding-bottom: 0.5rem;
        }
        
        .actions-section {
          display: flex;
          justify-content: flex-end;
        }
        
        .modal-btn, .theme-toggle-btn, .checkout-btn {
          background-color: var(--primary-color);
          color: white;
          border: none;
          border-radius: 4px;
          padding: 0.5rem 1rem;
          cursor: pointer;
          font-size: 1rem;
          margin-top: 1rem;
          transition: background-color 0.2s ease;
        }
        
        .modal-btn:hover, .theme-toggle-btn:hover, .checkout-btn:hover {
          background-color: #0051b3;
        }
        
        .cart-items {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .cart-item {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem;
          border-bottom: 1px solid #eee;
        }
        
        .cart-total {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 2px solid var(--primary-color);
          text-align: right;
        }
      `}</style>
    </div>
  );
}