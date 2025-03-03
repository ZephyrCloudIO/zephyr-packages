import React from 'react';
import type { Metadata } from 'next';
import { FederationProvider } from 'multi-remote-ssr-shared';
import { createDefaultStore } from 'multi-remote-ssr-shared/utils';

export const metadata: Metadata = {
  title: 'Remote B - Multi-Remote SSR Demo',
  description: 'Demo of remote B in a multi-remote SSR setup with Zephyr',
};

// Create an initial store for SSR
const initialStore = createDefaultStore('ssr');
initialStore.meta.remoteVersions = {
  'remote_b': '0.1.0'
};

// Sample product data for SSR
const sampleProducts = [
  {
    id: 'product-1',
    name: 'Product 1',
    description: 'This is a sample product',
    price: 19.99,
    image: 'https://via.placeholder.com/300x200',
    rating: 4,
    inStock: true
  }
];

// Add initial state for components that will be server-rendered
initialStore.remotes = {
  'remote_b': {
    'productList': {
      id: 'productList',
      sortBy: 'default',
      cartItems: 0,
      filterInStock: false,
      hydrated: false
    },
    'content_featured': {
      id: 'content_featured',
      expanded: false,
      hasInteracted: false,
      hydrated: false
    }
  }
};

// Initialize shared context
initialStore.sharedContext = {
  theme: 'light',
  locale: 'en-US'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // For a standalone page, we provide the FederationProvider
  // When used as a remote, the host will provide this
  return (
    <html lang="en">
      <body>
        <FederationProvider initialStore={initialStore}>
          {children}
        </FederationProvider>
        
        {/* Scripts for hydration */}
        <script
          id="__ZEPHYR_SSR_STORE_SCRIPT__"
          type="application/json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(initialStore)
          }}
        />
        
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const storeData = document.getElementById('__ZEPHYR_SSR_STORE_SCRIPT__');
                  if (storeData) {
                    window.__ZEPHYR_SSR_STORE = JSON.parse(storeData.textContent || '{}');
                  }
                } catch (e) {
                  console.error('Failed to parse SSR store data:', e);
                }
              })();
            `
          }}
        />
      </body>
    </html>
  );
}