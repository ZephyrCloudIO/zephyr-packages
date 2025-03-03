// Remote Streaming Components
declare module "remote/ProductStream" {
  const ProductStream: React.ComponentType<{
    productId: string;
    initialData?: any;
    priority?: 'high' | 'medium' | 'low';
  }>;
  export default ProductStream;
}

declare module "remote/CommentsStream" {
  const CommentsStream: React.ComponentType<{
    contentId: string;
    limit?: number;
    priority?: 'high' | 'medium' | 'low';
  }>;
  export default CommentsStream;
}

declare module "remote/RecommendationsStream" {
  const RecommendationsStream: React.ComponentType<{
    userId: string;
    productId?: string;
    limit?: number;
    priority?: 'high' | 'medium' | 'low';
  }>;
  export default RecommendationsStream;
}

declare module "remote/ProfileStream" {
  const ProfileStream: React.ComponentType<{
    userId: string;
    detailed?: boolean;
    priority?: 'high' | 'medium' | 'low';
  }>;
  export default ProfileStream;
}

// Shell Streaming Components
declare module "shell/StreamingLayout" {
  const StreamingLayout: React.ComponentType<{
    children: React.ReactNode;
    critical?: boolean;
    priority?: 'high' | 'medium' | 'low';
  }>;
  export default StreamingLayout;
}

declare module "shell/StreamingRegion" {
  const StreamingRegion: React.ComponentType<{
    children: React.ReactNode;
    fallback?: React.ReactNode;
    priority?: 'high' | 'medium' | 'low';
    deferTime?: number;
  }>;
  export default StreamingRegion;
}

declare module "shell/ProgressiveHydration" {
  const ProgressiveHydration: React.ComponentType<{
    children: React.ReactNode;
    priority?: 'high' | 'medium' | 'low';
    visibilityThreshold?: number;
  }>;
  export default ProgressiveHydration;
}

declare module "shell/ResourcePrioritizer" {
  const ResourcePrioritizer: React.ComponentType<{
    resources: Array<{
      id: string;
      priority: 'high' | 'medium' | 'low';
      load: () => Promise<any>;
    }>;
    children: React.ReactNode;
  }>;
  export default ResourcePrioritizer;
}