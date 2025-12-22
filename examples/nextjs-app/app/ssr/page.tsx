import Image from 'next/image';
import Link from 'next/link';

// Force dynamic rendering (SSR on every request)
export const dynamic = 'force-dynamic';

// Simulate async data fetching
async function getServerData() {
  // Simulate a delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    serverTime: new Date().toISOString(),
    randomNumber: Math.floor(Math.random() * 1000),
    requestId: Math.random().toString(36).substring(7),
  };
}

export default async function SSRPage() {
  const data = await getServerData();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex items-center gap-4">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Next.js logo"
            width={100}
            height={20}
            priority
          />
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            SSR Example
          </span>
        </div>

        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Server-Side Rendering (SSR)
          </h1>

          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            This page is rendered on the server for every request. Refresh the
            page to see new data generated on each request.
          </p>

          <div className="w-full max-w-md space-y-4 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-zinc-50 dark:bg-zinc-900">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Server Data:
              </h2>
              <div className="space-y-1 text-sm">
                <p className="text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">Server Time:</span>{' '}
                  <code className="text-zinc-900 dark:text-zinc-100">
                    {data.serverTime}
                  </code>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">Random Number:</span>{' '}
                  <code className="text-zinc-900 dark:text-zinc-100">
                    {data.randomNumber}
                  </code>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">Request ID:</span>{' '}
                  <code className="text-zinc-900 dark:text-zinc-100">
                    {data.requestId}
                  </code>
                </p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-md space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Key Features of SSR:
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>HTML generated on server for each request</li>
              <li>Always up-to-date data</li>
              <li>Optimized for SEO</li>
              <li>Fast initial load (no JS bundle execution needed)</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <Link
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="/"
          >
            Back to Home
          </Link>
          <Link
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="/ssr"
          >
            Refresh
          </Link>
        </div>
      </main>
    </div>
  );
}


export const runtime = 'edge';