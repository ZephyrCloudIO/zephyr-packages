// Common types shared between host and remotes

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  category: string;
  inStock: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  rating: number;
  content: string;
  date: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  preferences: {
    theme: 'light' | 'dark';
    currency: 'USD' | 'EUR' | 'GBP';
  };
}

export type ThemeMode = 'light' | 'dark';

export type RenderMode = 'server' | 'client' | 'hybrid';