// Common types shared between host and remotes

// Priority types for streaming components
export type StreamingPriority = 'critical' | 'high' | 'medium' | 'low';

// Streaming component configuration
export interface StreamingComponentConfig {
  priority: StreamingPriority;
  deferTime?: number; // Time in ms to defer loading
  visibilityThreshold?: number; // Viewport visibility threshold (0-1)
  retry?: number; // Number of retries for failed loads
  timeout?: number; // Timeout in ms for load attempts
  cacheKey?: string; // Key for caching results
  cacheTime?: number; // Time in ms to cache results
}

// Data model types
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  inStock: boolean;
  rating: number;
  reviews: number;
  specifications: Record<string, string>;
  relatedProducts: string[];
}

export interface Comment {
  id: string;
  contentId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: string;
  likes: number;
  replies?: Comment[];
}

export interface Recommendation {
  id: string;
  productId: string;
  name: string;
  image: string;
  price: number;
  rating: number;
  category: string;
  relevanceScore: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  joinDate: string;
  bio?: string;
  location?: string;
  preferences: Record<string, any>;
  stats: {
    orders: number;
    reviews: number;
    wishlists: number;
  };
}

// Streaming state types
export interface StreamingState {
  loading: boolean;
  error: Error | null;
  data: any;
  partial: boolean; // Indicates if data is partially loaded
  progress: number; // Progress indication (0-100)
  startTime?: number; // When loading started
  endTime?: number; // When loading completed
  streamingPriority: StreamingPriority;
}

// Resource loading types
export interface Resource<T> {
  id: string;
  priority: StreamingPriority;
  load: () => Promise<T>;
  data?: T;
  error?: Error;
  loading: boolean;
  loaded: boolean;
  startTime?: number;
  endTime?: number;
}