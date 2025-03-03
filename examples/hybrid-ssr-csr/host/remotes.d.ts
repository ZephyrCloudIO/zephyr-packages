// SSR Remote Components
declare module "ssrRemote/ServerProduct" {
  const ServerProduct: React.ComponentType<{
    id: string;
    name: string;
    description: string;
    price: number;
    image?: string;
  }>;
  export default ServerProduct;
}

declare module "ssrRemote/ServerCard" {
  const ServerCard: React.ComponentType<{
    title: string;
    content: string;
    image?: string;
  }>;
  export default ServerCard;
}

declare module "ssrRemote/ServerHeader" {
  const ServerHeader: React.ComponentType<{
    title: string;
    subtitle?: string;
  }>;
  export default ServerHeader;
}

// CSR Remote Components
declare module "csrRemote/ClientProduct" {
  const ClientProduct: React.ComponentType<{
    id: string;
    name: string;
    description: string;
    price: number;
    image?: string;
    onAddToCart: (id: string) => void;
  }>;
  export default ClientProduct;
}

declare module "csrRemote/ClientCarousel" {
  const ClientCarousel: React.ComponentType<{
    items: Array<{
      id: string;
      image: string;
      title: string;
    }>;
  }>;
  export default ClientCarousel;
}

declare module "csrRemote/ClientReviews" {
  const ClientReviews: React.ComponentType<{
    productId: string;
  }>;
  export default ClientReviews;
}