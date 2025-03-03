'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import DiagnosticPanel from '../../components/DiagnosticPanel';
import { StreamingPriority } from 'streaming-ssr-shared/dist/types';

// Import shell streaming components
const StreamingLayout = dynamic(() => import('shell/StreamingLayout'), {
  ssr: true,
  loading: () => <div className="loading-shell">Loading streaming layout...</div>
});

const StreamingRegion = dynamic(() => import('shell/StreamingRegion'), {
  ssr: true,
  loading: () => <div className="loading-shell">Loading streaming region...</div>
});

const ProgressiveHydration = dynamic(() => import('shell/ProgressiveHydration'), {
  ssr: true,
  loading: () => <div className="loading-shell">Loading progressive hydration...</div>
});

// Import remote streaming components
const CommentsStream = dynamic(() => import('remote/CommentsStream'), {
  ssr: true,
  loading: () => <div className="loading-component">Loading comments component...</div>
});

const RecommendationsStream = dynamic(() => import('remote/RecommendationsStream'), {
  ssr: true,
  loading: () => <div className="loading-component">Loading recommendations component...</div>
});

/**
 * Article page demonstrating streaming of long-form content with deferred loading
 * 
 * Features:
 * - Progressive content loading based on scroll position
 * - Deferred hydration of interactive elements
 * - Content sectioning for optimal streaming
 * - Reading progress tracking
 */
export default function ArticlePage() {
  // Track reading progress
  const [readingProgress, setReadingProgress] = useState(0);
  // Track performance metrics
  const [metrics, setMetrics] = useState({
    contentSectionsLoaded: 0,
    interactiveElementsHydrated: 0,
    visibleSections: [] as string[]
  });
  
  // Setup scroll tracking
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleScroll = () => {
      // Calculate reading progress
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const scrollBottom = scrollTop + windowHeight;
      
      // Calculate progress percentage
      const progress = Math.min(
        100,
        Math.round((scrollBottom / documentHeight) * 100)
      );
      
      setReadingProgress(progress);
      
      // Track visible sections
      const sections = ['introduction', 'section1', 'section2', 'section3', 'conclusion', 'comments', 'recommendations'];
      const visibleSections = sections.filter(section => {
        const element = document.getElementById(section);
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        return rect.top < windowHeight && rect.bottom > 0;
      });
      
      setMetrics(prev => ({
        ...prev,
        contentSectionsLoaded: document.querySelectorAll('[data-section-loaded="true"]').length,
        visibleSections
      }));
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial calculation
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Article sections with varying loading priorities
  const articleSections = [
    {
      id: 'introduction',
      title: 'Introduction to Streaming SSR',
      priority: 'critical' as StreamingPriority,
      content: `
        <p>Streaming Server-Side Rendering (SSR) represents a significant advancement in web rendering technologies, offering developers a way to deliver content to users more efficiently than ever before. Unlike traditional SSR approaches, which require the entire page to be rendered on the server before sending anything to the client, streaming SSR allows servers to send chunks of HTML as they become available.</p>
        
        <p>This progressive transmission approach provides several key benefits: users see initial content more quickly, the Time to First Byte (TTFB) is reduced, and the perceived performance of applications improves dramatically. As web applications grow more complex, these performance optimizations become increasingly important for maintaining a positive user experience.</p>
        
        <p>In this article, we'll explore how streaming SSR works with React 18 and Module Federation, demonstrating practical implementation patterns and performance considerations. The examples provided showcase real-world applications of these technologies working together to create seamless, high-performance user experiences.</p>
      `
    },
    {
      id: 'section1',
      title: 'React 18 Streaming Features',
      priority: 'high' as StreamingPriority,
      content: `
        <p>React 18 introduces significant enhancements to server-side rendering through its new streaming capabilities. At the core of these improvements is the <code>renderToPipeableStream</code> API, which allows React components to be rendered progressively, sending HTML to the client as each piece is ready rather than waiting for the entire tree to complete.</p>
        
        <p>This approach is complemented by several key features:</p>
        
        <ul>
          <li><strong>Suspense</strong>: Components can "suspend" rendering while waiting for data, allowing other parts of the page to render and stream to the client</li>
          <li><strong>Selective Hydration</strong>: React prioritizes hydrating the parts of the page that users are interacting with first</li>
          <li><strong>Streaming HTML</strong>: Server components can stream their rendered HTML as they complete, rather than waiting for the entire page</li>
          <li><strong>Delayed Loading</strong>: Non-critical components can be intentionally delayed to prioritize important content</li>
        </ul>
        
        <p>These features create a foundation for more responsive applications, as users can see and interact with content much sooner, even if some parts of the page are still being processed in the background.</p>
      `
    },
    {
      id: 'section2',
      title: 'Module Federation Integration',
      priority: 'medium' as StreamingPriority,
      content: `
        <p>Module Federation creates unique challenges and opportunities when combined with streaming SSR. As a technology designed to load remote modules at runtime, Module Federation must be carefully integrated with React's streaming capabilities to ensure optimal performance.</p>
        
        <p>The key considerations when combining these technologies include:</p>
        
        <ul>
          <li><strong>Remote Loading Strategy</strong>: Remote modules must be loaded in a way that doesn't block the initial render</li>
          <li><strong>Suspense Boundaries</strong>: Strategic placement of Suspense boundaries around federated components allows the rest of the page to stream while remotes load</li>
          <li><strong>Progressive Hydration</strong>: Federated components can implement their own hydration strategies based on priority</li>
          <li><strong>Error Boundaries</strong>: Robust error handling ensures that failures in remote components don't affect the rest of the application</li>
        </ul>
        
        <p>When properly implemented, this integration provides the best of both worlds: modular, independently deployable frontend pieces that can be efficiently streamed to users for optimal performance.</p>
        
        <p>Our implementation demonstrates how to structure components for effective streaming, including priority-based loading, visibility-triggered rendering, and strategic hydration patterns.</p>
      `
    },
    {
      id: 'section3',
      title: 'Performance Optimization Strategies',
      priority: 'medium' as StreamingPriority,
      content: `
        <p>Performance optimization is a critical consideration when implementing streaming SSR with Module Federation. Several strategies can significantly improve the user experience:</p>
        
        <ol>
          <li>
            <strong>Critical Path Rendering</strong>: Identify and prioritize the components essential for the initial user experience. These components should be streamed first and hydrated immediately.
          </li>
          <li>
            <strong>Progressive Enhancement</strong>: Start with basic, server-rendered content and enhance it with client-side interactivity as resources become available.
          </li>
          <li>
            <strong>Selective Hydration</strong>: Instead of hydrating the entire page at once, prioritize hydration based on component importance and user interaction.
          </li>
          <li>
            <strong>Content Chunking</strong>: Break large content into smaller chunks that can be streamed and processed independently.
          </li>
          <li>
            <strong>Data Prefetching</strong>: For critical components, prefetch data on the server before rendering to minimize client-side data fetching.
          </li>
          <li>
            <strong>Lazy Loading</strong>: Defer the loading of below-the-fold content until it's about to enter the viewport.
          </li>
        </ol>
        
        <p>These strategies must be balanced against application complexity and maintenance considerations. While aggressive optimization can yield impressive performance gains, it often comes at the cost of increased implementation complexity.</p>
        
        <p>Real-world testing with various device and network conditions is essential to validate that optimizations provide meaningful benefits for users rather than just improving benchmark scores.</p>
      `
    },
    {
      id: 'conclusion',
      title: 'Conclusion and Future Directions',
      priority: 'low' as StreamingPriority,
      content: `
        <p>Streaming SSR with Module Federation represents a powerful approach to building high-performance, modular web applications. By combining these technologies, developers can create experiences that are both feature-rich and highly responsive.</p>
        
        <p>As these technologies continue to evolve, we can anticipate several future developments:</p>
        
        <ul>
          <li><strong>Enhanced Developer Tools</strong>: Better tooling for debugging and visualizing streaming SSR performance</li>
          <li><strong>Framework Optimizations</strong>: Greater integration of streaming patterns into frameworks and component libraries</li>
          <li><strong>Standardized Patterns</strong>: Emergence of best practices and design patterns specific to streaming architectures</li>
          <li><strong>Performance Metrics</strong>: New ways to measure and optimize the user experience in streaming applications</li>
        </ul>
        
        <p>Implementing streaming SSR with Module Federation today requires careful planning and consideration of the application architecture. However, the performance benefits make this approach well worth the investment for applications where user experience is a priority.</p>
        
        <p>By staying informed about the latest developments in these technologies and continuously refining implementation strategies, development teams can ensure their applications remain at the cutting edge of web performance.</p>
      `
    }
  ];
  
  return (
    <div className="article-page">
      {/* Reading progress indicator */}
      <div className="reading-progress-container">
        <div 
          className="reading-progress-bar"
          style={{ width: `${readingProgress}%` }}
        ></div>
      </div>
      
      <article className="article-content">
        <h1 className="article-title">Streaming SSR with Module Federation</h1>
        <div className="article-meta">
          <span className="article-author">By John Developer</span>
          <span className="article-date">Published on March 3, 2025</span>
          <span className="article-reading-time">10 min read</span>
        </div>
        
        {/* Diagnostic panel */}
        <DiagnosticPanel 
          id="article" 
          data={{ 
            readingProgress: `${readingProgress}%`,
            contentSectionsLoaded: metrics.contentSectionsLoaded,
            visibleSections: metrics.visibleSections.join(', ')
          }}
        />
        
        {/* Article sections with different loading priorities */}
        {articleSections.map((section, index) => (
          <StreamingRegion
            key={section.id}
            priority={section.priority}
            deferTime={index * 500} // Stagger loading
            visibilityThreshold={0.1}
          >
            <section 
              id={section.id} 
              className="article-section"
              data-section-loaded="true"
            >
              <h2 className="section-title">{section.title}</h2>
              <div 
                className="section-content"
                dangerouslySetInnerHTML={{ __html: section.content }}
              />
            </section>
          </StreamingRegion>
        ))}
        
        {/* Interactive comments section - loaded only when user scrolls near it */}
        <div id="comments" className="article-section">
          <StreamingRegion
            priority="low"
            deferTime={2000}
            visibilityThreshold={0.3}
          >
            <ProgressiveHydration
              priority="low"
              visibilityThreshold={0.5}
              hydrateOnInteraction={true}
            >
              <StreamingLayout
                title="Discussion"
                priority="low"
                showDiagnostics={true}
              >
                <CommentsStream
                  contentId="article-streaming-ssr"
                  priority="low"
                />
              </StreamingLayout>
            </ProgressiveHydration>
          </StreamingRegion>
        </div>
        
        {/* Related content - lowest priority, loaded last */}
        <div id="recommendations" className="article-section">
          <StreamingRegion
            priority="low"
            deferTime={3000}
            visibilityThreshold={0.1}
          >
            <StreamingLayout
              title="Related Articles"
              priority="low"
              showDiagnostics={true}
            >
              <RecommendationsStream
                userId="1"
                limit={3}
                priority="low"
              />
            </StreamingLayout>
          </StreamingRegion>
        </div>
      </article>
      
      <style jsx>{`
        .article-page {
          position: relative;
          max-width: 800px;
          margin: 0 auto;
        }
        
        .reading-progress-container {
          position: fixed;
          top: 58px;
          left: 0;
          width: 100%;
          height: 4px;
          background-color: #f0f0f0;
          z-index: 100;
        }
        
        .reading-progress-bar {
          height: 100%;
          background-color: var(--primary-color);
          width: 0;
          transition: width 0.3s;
        }
        
        .article-content {
          padding: 20px 0 60px;
        }
        
        .article-title {
          font-size: 2.5rem;
          line-height: 1.2;
          margin-bottom: 16px;
          color: var(--text-color);
        }
        
        .article-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 32px;
          color: var(--text-light);
          font-size: 0.9rem;
        }
        
        .article-section {
          margin-bottom: 40px;
          animation: fadeIn 0.5s ease-in-out;
        }
        
        .section-title {
          font-size: 1.8rem;
          margin-bottom: 20px;
          color: var(--text-color);
        }
        
        .section-content {
          font-size: 1.1rem;
          line-height: 1.6;
          color: var(--text-color);
        }
        
        .section-content p {
          margin-bottom: 1.2em;
        }
        
        .section-content ul,
        .section-content ol {
          margin-bottom: 1.2em;
          padding-left: 2em;
        }
        
        .section-content li {
          margin-bottom: 0.5em;
        }
        
        .section-content strong {
          font-weight: 600;
        }
        
        .section-content code {
          background-color: #f5f5f5;
          padding: 2px 4px;
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 0.9em;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}