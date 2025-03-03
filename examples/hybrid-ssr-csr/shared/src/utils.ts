// Shared utility functions

import { Product, CartItem } from './types';

// Format currency based on locale and currency code
export const formatCurrency = (amount: number, currency = 'USD', locale = 'en-US'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
};

// Calculate cart total
export const calculateTotal = (items: CartItem[]): number => {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
};

// Filter products by category
export const filterProductsByCategory = (products: Product[], category: string): Product[] => {
  if (category === 'all') return products;
  return products.filter(product => product.category === category);
};

// Sort products by different criteria
export type SortOption = 'price-low' | 'price-high' | 'name';

export const sortProducts = (products: Product[], sortBy: SortOption): Product[] => {
  const sorted = [...products];
  
  switch (sortBy) {
    case 'price-low':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price-high':
      return sorted.sort((a, b) => b.price - a.price);
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted;
  }
};

// Check if code is running on server or client
export const isServer = (): boolean => {
  return typeof window === 'undefined';
};