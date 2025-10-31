import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/about')({
  component: About,
});

function About() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto py-20">
        <h1 className="text-5xl font-bold text-white mb-8">About This SPA</h1>
        <div className="space-y-6 text-gray-300 text-lg leading-relaxed">
          <p>
            This is a demonstration of TanStack Start running in{' '}
            <span className="text-cyan-400 font-semibold">SPA mode</span>,
            showcasing the power of modern single-page applications.
          </p>
          <p>
            Built with cutting-edge technologies, this application leverages:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>
              <span className="text-cyan-400 font-semibold">
                TanStack Router
              </span>{' '}
              for type-safe, file-based routing
            </li>
            <li>
              <span className="text-cyan-400 font-semibold">Vite</span> for
              lightning-fast builds and HMR
            </li>
            <li>
              <span className="text-cyan-400 font-semibold">React 19</span> with
              the latest features
            </li>
            <li>
              <span className="text-cyan-400 font-semibold">Tailwind CSS</span>{' '}
              for beautiful, responsive design
            </li>
          </ul>
          <p>
            All pages are pre-rendered at build time (SSG) for optimal
            performance and SEO, while maintaining full client-side
            interactivity.
          </p>
          <div className="mt-8 p-6 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">
              What is SPA Mode?
            </h2>
            <p>
              SPA mode combines the best of both worlds: static site generation
              (SSG) at build time for fast initial loads, with full client-side
              routing and interactivity once the application is loaded. No
              server required!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
