import React from 'react';
import type { Metadata } from 'next';
import { FederationProvider } from 'multi-remote-ssr-shared';
import { createDefaultStore } from 'multi-remote-ssr-shared/utils';

export const metadata: Metadata = {
  title: 'Remote C - Multi-Remote SSR Demo',
  description: 'Demo of remote C in a multi-remote SSR setup with Zephyr',
};

// Create an initial store for SSR
const initialStore = createDefaultStore('ssr');
initialStore.meta.remoteVersions = {
  'remote_c': '0.1.0'
};

// Add initial state for components that will be server-rendered
initialStore.remotes = {
  'remote_c': {
    'notification_info': {
      id: 'notification_info',
      visible: true,
      closing: false,
      hydrated: false
    },
    'loading_spinner': {
      id: 'loading_spinner',
      visible: true,
      progress: 0,
      hydrated: false
    },
    'modal_demo': {
      id: 'modal_demo',
      isOpen: false,
      fadeIn: false,
      fadeOut: false,
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