import React from 'react';
import { FederationProvider } from 'multi-remote-ssr-shared/context';
import { createDefaultStore } from 'multi-remote-ssr-shared/utils';
import { Metadata } from 'next';

// Define metadata for the application
export const metadata: Metadata = {
  title: 'Multi-Remote SSR Example - Host',
  description: 'A demonstration of server-side rendering with multiple federated remotes',
};

// Dynamically import remote components for proper SSR handling
const RemoteHeader = React.lazy(() => import('remote-a/Header'));
const RemoteNavigation = React.lazy(() => import('remote-a/Navigation'));
const RemoteUserProfile = React.lazy(() => import('remote-a/UserProfile'));

// Navigation items for the application
const navItems = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'products', label: 'Products', href: '/products' },
  { id: 'about', label: 'About', href: '/about' },
  { id: 'contact', label: 'Contact', href: '/contact' },
];

// Root layout component that wraps the entire application
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Create server-side store with SSR rendering mode
  const initialStore = createDefaultStore('ssr');
  
  return (
    <html lang="en">
      <body>
        <FederationProvider initialStore={initialStore}>
          {/* Wrap remote components in Suspense for SSR support */}
          <React.Suspense fallback={<div>Loading header...</div>}>
            <RemoteHeader title="Multi-Remote SSR Demo" />
          </React.Suspense>
          
          <div className="app-container">
            <aside className="sidebar">
              <React.Suspense fallback={<div>Loading navigation...</div>}>
                <RemoteNavigation items={navItems} />
              </React.Suspense>
              
              <div className="user-profile-container">
                <React.Suspense fallback={<div>Loading user profile...</div>}>
                  <RemoteUserProfile />
                </React.Suspense>
              </div>
            </aside>
            
            <main className="content-area">
              {children}
            </main>
          </div>
          
          {/* Add basic styling for layout */}
          <style jsx global>{`
            :root {
              --header-height: 60px;
              --sidebar-width: 250px;
              --primary-color: #0070f3;
              --secondary-color: #f7f7f7;
            }
            
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
                'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
            }
            
            .app-container {
              display: flex;
              min-height: calc(100vh - var(--header-height));
            }
            
            .sidebar {
              width: var(--sidebar-width);
              background-color: var(--secondary-color);
              padding: 1rem;
              display: flex;
              flex-direction: column;
            }
            
            .user-profile-container {
              margin-top: auto;
              padding-top: 1rem;
            }
            
            .content-area {
              flex: 1;
              padding: 1.5rem;
            }
          `}</style>
        </FederationProvider>
      </body>
    </html>
  );
}