'use client';

import React from 'react';
import Link from 'next/link';
import { FederationProvider } from 'hybrid-ssr-csr-shared/dist/federation-context';
import { ThemeMode } from 'hybrid-ssr-csr-shared/dist/types';
import { getThemeClass } from 'hybrid-ssr-csr-shared/dist/theme';
import './globals.css';

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const [themeMode, setThemeMode] = React.useState<ThemeMode>('light');
  
  // Toggle theme mode
  const toggleTheme = () => {
    setThemeMode(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };
  
  return (
    <html lang="en" className={getThemeClass(themeMode)}>
      <head>
        <title>Hybrid SSR/CSR Demo</title>
        <meta name="description" content="Demonstration of hybrid SSR/CSR rendering with Module Federation" />
      </head>
      <body>
        <FederationProvider initialTheme={themeMode}>
          <div className="app-container">
            <header className="app-header">
              <div className="header-content">
                <div className="logo">
                  <Link href="/">Hybrid Demo</Link>
                </div>
                
                <nav className="main-nav">
                  <ul>
                    <li>
                      <Link href="/">Home</Link>
                    </li>
                    <li>
                      <Link href="/products">Products</Link>
                    </li>
                    <li>
                      <Link href="/reviews">Reviews</Link>
                    </li>
                  </ul>
                </nav>
                
                <div className="theme-toggle">
                  <button onClick={toggleTheme}>
                    {themeMode === 'light' ? '🌙' : '☀️'}
                  </button>
                </div>
              </div>
            </header>
            
            <main className="app-main">
              {children}
            </main>
            
            <footer className="app-footer">
              <div className="footer-content">
                <p>
                  Hybrid SSR/CSR Demo with Module Federation
                </p>
                <p>
                  <small>
                    Server Components + Client Components with Progressive Enhancement
                  </small>
                </p>
              </div>
            </footer>
          </div>
        </FederationProvider>
      </body>
    </html>
  );
}