import React from 'react';
import ProductList from '../components/ProductList';
import ContentBlock from '../components/ContentBlock';
import { ProductData } from '../components/ProductCard';
import { ContentBlockData } from '../components/ContentBlock';

// Sample product data
const sampleProducts: ProductData[] = [
  {
    id: 'product-1',
    name: 'Premium Headphones',
    description: 'Wireless noise-cancelling headphones with premium sound quality.',
    price: 249.99,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
    rating: 4.5,
    inStock: true
  },
  {
    id: 'product-2',
    name: 'Smart Watch',
    description: 'Feature-rich smartwatch with health tracking and notifications.',
    price: 199.99,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
    rating: 4.2,
    inStock: true
  },
  {
    id: 'product-3',
    name: 'Portable Speaker',
    description: 'Waterproof portable speaker with 20-hour battery life.',
    price: 129.99,
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1',
    rating: 4.7,
    inStock: false
  }
];

// Sample content blocks
const contentBlocks: ContentBlockData[] = [
  {
    id: 'content-1',
    title: 'Featured Products',
    content: 'Discover our latest collection of premium products designed to enhance your lifestyle. Our carefully curated selection offers the perfect blend of innovation, quality, and style.',
    imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d',
    callToAction: {
      text: 'View All Products',
      url: '#products'
    },
    variant: 'featured'
  },
  {
    id: 'content-2',
    title: 'Limited Time Offer',
    content: 'For a limited time only, enjoy special discounts on our most popular items. Don\'t miss this opportunity to upgrade your tech at exceptional prices.',
    callToAction: {
      text: 'Shop Now',
      url: '#special-offers'
    },
    variant: 'highlight'
  },
  {
    id: 'content-3',
    title: 'About Our Products',
    content: 'At our company, we believe in creating products that seamlessly integrate into your daily life while pushing the boundaries of what\'s possible. Each item is crafted with attention to detail, using premium materials and cutting-edge technology. Our design philosophy centers around the perfect balance of form and function, ensuring that every product not only performs exceptionally but also enhances your environment.\n\nOur commitment to quality means rigorous testing at every stage of development. We stand behind our products with confidence, offering warranties that reflect our belief in their durability and performance. Customer satisfaction is at the heart of everything we do, which is why we continuously seek feedback and improve our offerings based on real user experiences.',
    variant: 'default'
  }
];

export default function Home() {
  return (
    <main style={{
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px'
    }}>
      <h1>Remote B - Products & Content</h1>
      
      <div style={{ marginBottom: '30px' }}>
        <p>
          This is Remote B's standalone page. It exposes ProductCard, ProductList, and ContentBlock
          components that can be consumed by other applications.
        </p>
      </div>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '30px'
      }}>
        {/* Featured content block */}
        <ContentBlock 
          id="content_featured"
          data={contentBlocks[0]} 
        />
        
        {/* Product list */}
        <ProductList 
          id="productList"
          products={sampleProducts} 
          title="Our Products" 
        />
        
        {/* Additional content blocks */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: '20px'
        }}>
          <ContentBlock 
            id="content_offer"
            data={contentBlocks[1]} 
          />
          <ContentBlock 
            id="content_about"
            data={contentBlocks[2]} 
          />
        </div>
      </div>
      
      <div style={{ 
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#f0f7ff',
        borderRadius: '8px',
        border: '1px solid #d0e0ff'
      }}>
        <h3>Federation Information</h3>
        <ul>
          <li><strong>Remote Name:</strong> remote_b</li>
          <li><strong>Version:</strong> 0.1.0</li>
          <li><strong>Type:</strong> product components</li>
          <li><strong>Capabilities:</strong> SSR, lazy-loading, data-fetching</li>
          <li><strong>Dependencies:</strong> Consumes components from Remote A</li>
          <li><strong>Exposed Components:</strong> ProductCard, ProductList, ContentBlock</li>
        </ul>
      </div>
    </main>
  );
}