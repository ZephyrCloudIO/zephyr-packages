import React, { useState, useEffect, Suspense } from 'react';

interface ComplexComponentProps {
  /**
   * Initial data to display
   */
  initialData?: {
    title: string;
    items: Array<{ id: number; name: string }>;
    config?: Record<string, any>;
  };
  
  /**
   * Whether to load data dynamically
   */
  dynamicLoading?: boolean;
  
  /**
   * Optional className
   */
  className?: string;
  
  /**
   * Optional data loading error simulation
   */
  simulateError?: boolean;
}

// Simulate data loading
const loadData = (simulateError = false) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (simulateError) {
        reject(new Error('Failed to load data'));
      } else {
        resolve({
          title: 'Dynamic Content',
          items: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' },
            { id: 3, name: 'Item 3' },
          ],
          config: {
            showDetails: true,
            theme: 'light',
          },
        });
      }
    }, 200);
  });
};

// Lazy-loaded detail component
const DetailView = React.lazy(() => 
  new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        default: ({ item }: { item: { id: number; name: string } }) => (
          <div className="detail-view" data-testid={`detail-${item.id}`}>
            <h3>Details for {item.name}</h3>
            <p>ID: {item.id}</p>
            <p>Created at: {new Date().toISOString()}</p>
          </div>
        ),
      });
    }, 150);
  })
);

// Loading fallback
const LoadingFallback = () => (
  <div className="loading-fallback" data-testid="loading-fallback">
    Loading content...
  </div>
);

// Error fallback
const ErrorFallback = ({ error }: { error: Error }) => (
  <div className="error-fallback" data-testid="error-fallback">
    <h3>Error loading content</h3>
    <p>{error.message}</p>
  </div>
);

/**
 * A complex component with dynamic loading, suspense, and nested components
 */
export function ComplexComponent({
  initialData,
  dynamicLoading = false,
  className = '',
  simulateError = false,
}: ComplexComponentProps) {
  const [data, setData] = useState(initialData);
  const [activeItem, setActiveItem] = useState<{ id: number; name: string } | null>(null);
  const [loading, setLoading] = useState(dynamicLoading);
  const [error, setError] = useState<Error | null>(null);
  const [theme, setTheme] = useState('light');
  
  useEffect(() => {
    if (dynamicLoading) {
      setLoading(true);
      loadData(simulateError)
        .then((result: any) => {
          setData(result);
          setLoading(false);
        })
        .catch((err: Error) => {
          setError(err);
          setLoading(false);
        });
    }
  }, [dynamicLoading, simulateError]);
  
  const handleItemClick = (item: { id: number; name: string }) => {
    setActiveItem(activeItem?.id === item.id ? null : item);
  };
  
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };
  
  if (loading) {
    return <LoadingFallback />;
  }
  
  if (error) {
    return <ErrorFallback error={error} />;
  }
  
  if (!data) {
    return (
      <div className="no-data" data-testid="no-data">
        No data available
      </div>
    );
  }
  
  return (
    <div 
      className={`complex-component ${className} theme-${theme}`}
      data-testid="complex-component"
    >
      <header className="header">
        <h2>{data.title}</h2>
        <button 
          className="theme-toggle" 
          onClick={toggleTheme}
          data-testid="theme-toggle"
        >
          Toggle Theme
        </button>
      </header>
      
      <div className="content">
        <ul className="item-list">
          {data.items.map((item) => (
            <li 
              key={item.id}
              className={`item ${activeItem?.id === item.id ? 'active' : ''}`}
              onClick={() => handleItemClick(item)}
              data-testid={`item-${item.id}`}
            >
              {item.name}
            </li>
          ))}
        </ul>
        
        {activeItem && (
          <div className="detail-container">
            <Suspense fallback={<LoadingFallback />}>
              <DetailView item={activeItem} />
            </Suspense>
          </div>
        )}
      </div>
      
      <footer className="footer">
        <p>Total items: {data.items.length}</p>
        {data.config?.showDetails && (
          <div className="config-panel">
            <h4>Configuration</h4>
            <pre>{JSON.stringify(data.config, null, 2)}</pre>
          </div>
        )}
      </footer>
    </div>
  );
}

export default ComplexComponent;