import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Next.js SSR Remote',
  description: 'Next.js SSR remote example with Module Federation and Zephyr',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        
        {/* This script will be used to inject the SSR store data */}
        <script
          id="__ZEPHYR_SSR_STORE_SCRIPT__"
          type="application/json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              'nextjs-ssr-basic-remote': {
                'example-server-component': {
                  id: 'example-server-component',
                  text: 'This is a server-rendered component.',
                  hydrated: false,
                  clickCount: 0
                },
                'example-server-component_button': {
                  id: 'example-server-component_button',
                  text: 'Server Component Button',
                  hydrated: false,
                  clickCount: 0
                }
              }
            })
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