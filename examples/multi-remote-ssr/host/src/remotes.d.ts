// Type declarations for remote modules

declare module 'remote-a/Header' {
  const Header: React.ComponentType<{
    title?: string;
    theme?: 'light' | 'dark';
    expanded?: boolean;
  }>;
  export default Header;
}

declare module 'remote-a/Navigation' {
  export interface NavItem {
    id: string;
    label: string;
    href: string;
    icon?: string;
    children?: NavItem[];
  }
  
  const Navigation: React.ComponentType<{
    items: NavItem[];
    activeId?: string;
    onNavigate?: (item: NavItem) => void;
  }>;
  export default Navigation;
}

declare module 'remote-a/UserProfile' {
  export interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  }
  
  const UserProfile: React.ComponentType<{
    userId?: string;
    onLogin?: () => void;
    onLogout?: () => void;
  }>;
  export default UserProfile;
}

declare module 'remote-b/ContentBlock' {
  const ContentBlock: React.ComponentType<{
    id: string;
    title: string;
    content: string | React.ReactNode;
    collapsed?: boolean;
    variant?: 'default' | 'highlighted' | 'bordered';
  }>;
  export default ContentBlock;
}

declare module 'remote-b/ProductCard' {
  export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    imageUrl?: string;
    inStock: boolean;
  }
  
  const ProductCard: React.ComponentType<{
    product: Product;
    onAddToCart?: (product: Product) => void;
  }>;
  export default ProductCard;
}

declare module 'remote-b/ProductList' {
  import { Product } from 'remote-b/ProductCard';
  
  const ProductList: React.ComponentType<{
    products: Product[];
    onAddToCart?: (product: Product) => void;
    onFilterChange?: (filters: Record<string, any>) => void;
    onSortChange?: (sortBy: string) => void;
  }>;
  export default ProductList;
}

declare module 'remote-c/Loading' {
  const Loading: React.ComponentType<{
    type?: 'spinner' | 'dots' | 'pulse' | 'skeleton';
    size?: 'small' | 'medium' | 'large';
    text?: string;
    fullScreen?: boolean;
  }>;
  export default Loading;
}

declare module 'remote-c/Modal' {
  const Modal: React.ComponentType<{
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    footer?: React.ReactNode;
    size?: 'small' | 'medium' | 'large' | 'fullscreen';
    children: React.ReactNode;
  }>;
  export default Modal;
}

declare module 'remote-c/Notification' {
  const Notification: React.ComponentType<{
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    description?: string;
    duration?: number;
    onClose?: () => void;
  }>;
  export default Notification;
}