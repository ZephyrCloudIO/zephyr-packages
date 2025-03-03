import React from 'react';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import LoadingFallback from '../components/LoadingFallback';

// Server Components (Statically imported)
import ServerHeader from 'ssrRemote/ServerHeader';
import ServerCard from 'ssrRemote/ServerCard';

// Client Components (Dynamically imported with lazy loading)
const ClientCarousel = dynamic(() => import('csrRemote/ClientCarousel'), {
  loading: () => <LoadingFallback type="skeleton" message="Loading carousel..." />,
  ssr: false // Disable SSR for this component - client-side only
});

// Page component using a mix of Server and Client Components
export default function HomePage() {
  // This data would typically come from a database or API
  // For server components, this happens on the server only
  const features = [
    {
      title: 'Server Components',
      content: 'Components rendered purely on the server, sent as HTML to the client with zero JavaScript overhead.',
      image: 'https://via.placeholder.com/400x200?text=Server+Components'
    },
    {
      title: 'Client Components',
      content: 'Interactive components rendered and hydrated on the client with full access to browser APIs and React hooks.',
      image: 'https://via.placeholder.com/400x200?text=Client+Components'
    },
    {
      title: 'Progressive Enhancement',
      content: 'Start with server-rendered HTML, then enhance with client-side interactivity for the best user experience.',
      image: 'https://via.placeholder.com/400x200?text=Progressive+Enhancement'
    },
  ];

  // Carousel items data
  const carouselItems = [
    {
      id: '1',
      image: 'https://via.placeholder.com/1200x600?text=Hybrid+Rendering',
      title: 'Hybrid SSR/CSR Rendering'
    },
    {
      id: '2',
      image: 'https://via.placeholder.com/1200x600?text=Module+Federation',
      title: 'Module Federation Integration'
    },
    {
      id: '3',
      image: 'https://via.placeholder.com/1200x600?text=Performance+Optimization',
      title: 'Performance Optimization'
    },
  ];

  return (
    <div className="home-page">
      {/* Server Component */}
      <ServerHeader 
        title="Hybrid SSR/CSR Demo" 
        subtitle="Demonstrating progressive enhancement with Module Federation"
        alignment="center"
      />
      
      {/* Client Component wrapped in Suspense and ErrorBoundary */}
      <section className="hero-section">
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback type="skeleton" />}>
            <ClientCarousel items={carouselItems} />
          </Suspense>
        </ErrorBoundary>
      </section>
      
      {/* Server Components for static content */}
      <section className="features-section">
        <h2 className="section-title">Key Features</h2>
        <div className="features-grid">
          {features.map((feature, index) => (
            <ServerCard
              key={index}
              title={feature.title}
              content={feature.content}
              image={feature.image}
              variant="elevated"
            />
          ))}
        </div>
      </section>
      
      <style jsx>{`
        .home-page {
          display: flex;
          flex-direction: column;
          gap: 40px;
        }
        
        .hero-section {
          margin-bottom: 20px;
        }
        
        .section-title {
          font-size: 28px;
          margin-bottom: 20px;
          color: var(--color-text);
          text-align: center;
        }
        
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        
        @media (max-width: 768px) {
          .features-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}