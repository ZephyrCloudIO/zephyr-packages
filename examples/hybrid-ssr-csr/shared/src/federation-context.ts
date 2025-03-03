// Federation context for state sharing between host and remotes
import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeMode, User, CartItem } from './types';
import { isServer } from './utils';

export interface FederationContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  user: User | null;
  setUser: (user: User | null) => void;
  cart: CartItem[];
  addToCart: (product: CartItem) => void;
  removeFromCart: (productId: string) => void;
  updateCartItemQuantity: (productId: string, quantity: number) => void;
}

// Define default values for the context
export const defaultContextValue: FederationContextType = {
  themeMode: 'light',
  setThemeMode: () => {},
  user: null,
  setUser: () => {},
  cart: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateCartItemQuantity: () => {},
};

// Create context
export const FederationContext = createContext<FederationContextType>(defaultContextValue);

// Context provider component
export interface FederationProviderProps {
  initialTheme?: ThemeMode;
  initialUser?: User | null;
  initialCart?: CartItem[];
  children: React.ReactNode;
}

export const FederationProvider: React.FC<FederationProviderProps> = ({
  initialTheme = 'light',
  initialUser = null,
  initialCart = [],
  children,
}) => {
  // Initialize state with initial values or retrieve from localStorage
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialTheme);
  const [user, setUser] = useState<User | null>(initialUser);
  const [cart, setCart] = useState<CartItem[]>(initialCart);

  // Load state from localStorage on client side
  useEffect(() => {
    if (!isServer()) {
      const storedTheme = localStorage.getItem('themeMode');
      const storedUser = localStorage.getItem('user');
      const storedCart = localStorage.getItem('cart');

      if (storedTheme) {
        setThemeMode(storedTheme as ThemeMode);
      }

      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {
          console.error('Failed to parse user data from localStorage');
        }
      }

      if (storedCart) {
        try {
          setCart(JSON.parse(storedCart));
        } catch (e) {
          console.error('Failed to parse cart data from localStorage');
        }
      }
    }
  }, []);

  // Save state to localStorage when it changes
  useEffect(() => {
    if (!isServer()) {
      localStorage.setItem('themeMode', themeMode);
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      } else {
        localStorage.removeItem('user');
      }
      localStorage.setItem('cart', JSON.stringify(cart));
    }
  }, [themeMode, user, cart]);

  // Cart operations
  const addToCart = (product: CartItem) => {
    setCart(prevCart => {
      const existingItemIndex = prevCart.findIndex(item => item.id === product.id);
      
      if (existingItemIndex >= 0) {
        // Item already exists, update quantity
        const updatedCart = [...prevCart];
        updatedCart[existingItemIndex] = {
          ...updatedCart[existingItemIndex],
          quantity: updatedCart[existingItemIndex].quantity + product.quantity
        };
        return updatedCart;
      } else {
        // Add new item
        return [...prevCart, product];
      }
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const updateCartItemQuantity = (productId: string, quantity: number) => {
    setCart(prevCart => {
      const updatedCart = prevCart.map(item => {
        if (item.id === productId) {
          return { ...item, quantity };
        }
        return item;
      });
      
      // Remove item if quantity is 0
      return updatedCart.filter(item => item.quantity > 0);
    });
  };

  // Context value
  const contextValue: FederationContextType = {
    themeMode,
    setThemeMode,
    user,
    setUser,
    cart,
    addToCart,
    removeFromCart,
    updateCartItemQuantity,
  };

  return (
    <FederationContext.Provider value={contextValue}>
      {children}
    </FederationContext.Provider>
  );
};

// Custom hook for using the Federation context
export const useFederation = () => useContext(FederationContext);