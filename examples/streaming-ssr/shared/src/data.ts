import { Product, Comment, Recommendation, UserProfile } from './types';
import { createDelay } from './streaming';

// Mock data and data fetching utilities for demonstration

/**
 * Mock data fetching with configurable delay and optional error
 */
export async function fetchWithDelay<T>(
  data: T, 
  options: { 
    delay?: number; 
    errorRate?: number; 
    errorMessage?: string; 
  } = {}
): Promise<T> {
  const { 
    delay = 500, 
    errorRate = 0, 
    errorMessage = 'Error fetching data' 
  } = options;
  
  // Simulate network delay
  await createDelay(delay);
  
  // Random error based on errorRate
  if (Math.random() < errorRate) {
    throw new Error(errorMessage);
  }
  
  return data;
}

/**
 * Fetch product by ID with streaming simulation
 */
export async function fetchProduct(
  id: string, 
  options: { 
    delay?: number;
    errorRate?: number;
  } = {}
): Promise<Product> {
  // Find product in mock data or generate one
  const product = mockProducts.find(p => p.id === id) || 
    generateMockProduct(id);
    
  return fetchWithDelay(product, options);
}

/**
 * Fetch comments with streaming simulation
 */
export async function fetchComments(
  contentId: string,
  options: {
    limit?: number;
    delay?: number;
    errorRate?: number;
  } = {}
): Promise<Comment[]> {
  const { limit = 10 } = options;
  
  // Generate mock comments if needed
  let comments = mockComments.filter(c => c.contentId === contentId);
  if (comments.length === 0) {
    comments = Array.from({ length: Math.floor(Math.random() * 20) + 5 }, 
      (_, i) => generateMockComment(contentId, i.toString()));
  }
  
  // Apply limit
  const limitedComments = comments.slice(0, limit);
  
  return fetchWithDelay(limitedComments, options);
}

/**
 * Fetch user profile with streaming simulation
 */
export async function fetchUserProfile(
  userId: string,
  options: {
    detailed?: boolean;
    delay?: number;
    errorRate?: number;
  } = {}
): Promise<UserProfile> {
  const { detailed = false } = options;
  
  // Find or generate user profile
  let profile = mockProfiles.find(p => p.id === userId);
  if (!profile) {
    profile = generateMockProfile(userId);
    mockProfiles.push(profile);
  }
  
  // If detailed, add more delay to simulate fetching more data
  const delay = options.delay || (detailed ? 1500 : 500);
  
  return fetchWithDelay(profile, {
    ...options,
    delay
  });
}

/**
 * Fetch recommendations with streaming simulation
 */
export async function fetchRecommendations(
  options: {
    userId?: string;
    productId?: string;
    limit?: number;
    delay?: number;
    errorRate?: number;
  } = {}
): Promise<Recommendation[]> {
  const { limit = 5, userId, productId } = options;
  
  // Generate mock recommendations
  let recommendations = mockRecommendations;
  if (productId) {
    // Filter by productId if provided
    recommendations = recommendations.filter(r => 
      mockProducts.find(p => p.id === productId)?.relatedProducts.includes(r.productId)
    );
    
    // If not enough, generate some
    if (recommendations.length < limit) {
      const additionalCount = limit - recommendations.length;
      const additional = Array.from({ length: additionalCount }, 
        (_, i) => generateMockRecommendation(i.toString(), productId));
      recommendations = [...recommendations, ...additional];
    }
  } else if (userId) {
    // Generate user-specific recommendations
    recommendations = Array.from({ length: limit }, 
      (_, i) => generateMockRecommendation(i.toString()));
  }
  
  // Apply limit
  const limitedRecommendations = recommendations.slice(0, limit);
  
  return fetchWithDelay(limitedRecommendations, options);
}

// Mock data generators

/**
 * Generate a mock product
 */
function generateMockProduct(id: string): Product {
  const categories = ['Electronics', 'Clothing', 'Home', 'Books', 'Toys'];
  const category = categories[Math.floor(Math.random() * categories.length)];
  
  const relatedProducts = Array.from(
    { length: Math.floor(Math.random() * 5) + 1 },
    (_, i) => `related-${id}-${i}`
  );
  
  return {
    id,
    name: `Product ${id}`,
    description: `This is a detailed description for product ${id}.`,
    price: Math.floor(Math.random() * 1000) + 10,
    images: [
      `https://picsum.photos/id/${Math.floor(Math.random() * 100)}/400/300`,
      `https://picsum.photos/id/${Math.floor(Math.random() * 100)}/400/300`,
    ],
    category,
    inStock: Math.random() > 0.2,
    rating: Math.floor(Math.random() * 50) / 10,
    reviews: Math.floor(Math.random() * 500),
    specifications: {
      'Weight': `${Math.floor(Math.random() * 5) + 1} kg`,
      'Dimensions': `${Math.floor(Math.random() * 50) + 10} x ${Math.floor(Math.random() * 30) + 5} x ${Math.floor(Math.random() * 20) + 2} cm`,
      'Color': ['Black', 'White', 'Red', 'Blue', 'Green'][Math.floor(Math.random() * 5)],
    },
    relatedProducts
  };
}

/**
 * Generate a mock comment
 */
function generateMockComment(contentId: string, commentId: string): Comment {
  const authorId = `user-${Math.floor(Math.random() * 100)}`;
  
  return {
    id: `comment-${commentId}`,
    contentId,
    authorId,
    authorName: `User ${authorId}`,
    authorAvatar: Math.random() > 0.3 ? `https://i.pravatar.cc/150?u=${authorId}` : undefined,
    text: `This is a comment on content ${contentId}. ${Math.random() > 0.5 ? 'I really liked it!' : 'It was pretty good.'}`,
    createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString(),
    likes: Math.floor(Math.random() * 50),
    replies: Math.random() > 0.7 ? [
      {
        id: `reply-${commentId}-1`,
        contentId,
        authorId: `user-${Math.floor(Math.random() * 100)}`,
        authorName: `User Reply`,
        text: `Thanks for your comment!`,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 10) * 86400000).toISOString(),
        likes: Math.floor(Math.random() * 10),
      }
    ] : undefined
  };
}

/**
 * Generate a mock user profile
 */
function generateMockProfile(userId: string): UserProfile {
  return {
    id: userId,
    name: `User ${userId}`,
    email: `user${userId}@example.com`,
    avatar: Math.random() > 0.3 ? `https://i.pravatar.cc/150?u=${userId}` : undefined,
    joinDate: new Date(Date.now() - Math.floor(Math.random() * 365 * 3) * 86400000).toISOString(),
    bio: Math.random() > 0.5 ? `This is the bio for user ${userId}.` : undefined,
    location: Math.random() > 0.5 ? ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][Math.floor(Math.random() * 5)] : undefined,
    preferences: {
      theme: Math.random() > 0.5 ? 'light' : 'dark',
      notifications: Math.random() > 0.3,
    },
    stats: {
      orders: Math.floor(Math.random() * 50),
      reviews: Math.floor(Math.random() * 20),
      wishlists: Math.floor(Math.random() * 10),
    }
  };
}

/**
 * Generate a mock recommendation
 */
function generateMockRecommendation(id: string, relatedToProductId?: string): Recommendation {
  const productId = relatedToProductId ? 
    `related-to-${relatedToProductId}-${id}` : 
    `recommendation-${id}`;
    
  const categories = ['Electronics', 'Clothing', 'Home', 'Books', 'Toys'];
  const category = categories[Math.floor(Math.random() * categories.length)];
  
  return {
    id: `rec-${id}`,
    productId,
    name: `Recommended Product ${productId}`,
    image: `https://picsum.photos/id/${Math.floor(Math.random() * 100)}/200/200`,
    price: Math.floor(Math.random() * 1000) + 10,
    rating: Math.floor(Math.random() * 50) / 10,
    category,
    relevanceScore: Math.floor(Math.random() * 100) / 100
  };
}

// Initial mock data
const mockProducts: Product[] = [
  generateMockProduct('1'),
  generateMockProduct('2'),
  generateMockProduct('3'),
];

const mockComments: Comment[] = [
  generateMockComment('product-1', '1'),
  generateMockComment('product-1', '2'),
  generateMockComment('product-2', '3'),
];

const mockProfiles: UserProfile[] = [
  generateMockProfile('1'),
  generateMockProfile('2'),
];

const mockRecommendations: Recommendation[] = [
  generateMockRecommendation('1'),
  generateMockRecommendation('2'),
  generateMockRecommendation('3'),
];