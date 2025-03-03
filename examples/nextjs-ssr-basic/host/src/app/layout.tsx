import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Next.js SSR Host',
  description: 'Next.js SSR host example with Module Federation and Zephyr',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initial Zephyr SSR Store data - This would typically be populated based on the
  // server-rendered components and their states
  const initialSSRStore = {
    'nextjs-ssr-basic-remote': {
      'ssr-server-component': {
        id: 'ssr-server-component',
        text: 'This component was rendered on the server by the host application',
        hydrated: false,
        clickCount: 0
      },
      'ssr-server-component_button': {
        id: 'ssr-server-component_button',
        text: 'Server Component Button',
        hydrated: false,
        clickCount: 0
      },
      'server-rendered-button': {
        id: 'server-rendered-button',
        text: 'Server Rendered Button',
        hydrated: false,
        clickCount: 0
      }
    }
  };

  return (
    <html lang="en">
      <body>
        {children}
        
        {/* This script will be used to inject the SSR store data */}
        <script
          id="__ZEPHYR_SSR_STORE_SCRIPT__"
          type="application/json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(initialSSRStore)
          }}
        />
        
        {/* Script to load the SSR store data into the window object */}
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