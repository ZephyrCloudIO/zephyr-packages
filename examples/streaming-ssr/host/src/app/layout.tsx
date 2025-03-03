import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Streaming SSR Demo',
  description: 'Demonstration of streaming server-side rendering with React 18+ and Module Federation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <div className="container app-header-content">
            <div className="logo">Streaming Demo</div>
            <nav>
              <ul className="nav-menu">
                <li>
                  <Link href="/" className="nav-link">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/product/1" className="nav-link">
                    Product
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard" className="nav-link">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/article" className="nav-link">
                    Article
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </header>
        
        <main className="main-content">
          <div className="container">
            {children}
          </div>
        </main>
        
        <footer className="app-footer">
          <div className="container app-footer-content">
            <div className="copyright">
              &copy; {new Date().getFullYear()} Streaming SSR Demo
            </div>
            <div>
              <Link href="/about">About</Link>
              {' | '}
              <Link href="https://github.com/user/streaming-ssr-demo">GitHub</Link>
            </div>
          </div>
        </footer>
        
        {/* Initialize timing for diagnostics */}
        <script dangerouslySetInnerHTML={{ __html: `window.__streamingStartTime = performance.now();` }} />
      </body>
    </html>
  );
}