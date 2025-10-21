import { createFileRoute } from '@tanstack/react-router';
import { FileCode, Zap, Shield, Blocks, Rocket, Globe } from 'lucide-react';

export const Route = createFileRoute('/features')({
  component: Features,
});

function Features() {
  const features = [
    {
      icon: <FileCode className="w-10 h-10 text-cyan-400" />,
      title: 'File-Based Routing',
      description:
        'Automatic route generation based on your file structure. Type-safe and intuitive.',
      tag: 'Routing',
    },
    {
      icon: <Zap className="w-10 h-10 text-yellow-400" />,
      title: 'Static Site Generation',
      description:
        'Pages are pre-rendered at build time for instant loading and optimal SEO performance.',
      tag: 'SSG',
    },
    {
      icon: <Shield className="w-10 h-10 text-green-400" />,
      title: 'Type Safety',
      description:
        'Full TypeScript support with end-to-end type inference for routes and navigation.',
      tag: 'TypeScript',
    },
    {
      icon: <Blocks className="w-10 h-10 text-purple-400" />,
      title: 'Code Splitting',
      description:
        'Automatic code splitting per route ensures optimal bundle sizes and fast page loads.',
      tag: 'Performance',
    },
    {
      icon: <Rocket className="w-10 h-10 text-red-400" />,
      title: 'Client-Side Navigation',
      description:
        'Lightning-fast navigation between pages with no full page reloads.',
      tag: 'SPA',
    },
    {
      icon: <Globe className="w-10 h-10 text-blue-400" />,
      title: 'Deploy Anywhere',
      description:
        'Static output can be deployed to any CDN or static hosting service. No server required.',
      tag: 'Deployment',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            Powerful Features
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Everything you need to build modern, performant single-page
            applications with static site generation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 group"
            >
              <div className="mb-4 transform group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>
              <div className="mb-2">
                <span className="text-xs font-semibold text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded">
                  {feature.tag}
                </span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-16 p-8 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl">
          <h2 className="text-3xl font-bold text-white mb-4">
            Static Site Generation (SSG)
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-4">
            This entire application is pre-rendered at build time, generating
            static HTML files for each route. This approach provides:
          </p>
          <ul className="grid md:grid-cols-2 gap-3 text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 mt-1">✓</span>
              <span>Instant page loads with zero server latency</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 mt-1">✓</span>
              <span>Perfect SEO with fully crawlable content</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 mt-1">✓</span>
              <span>Deploy to any CDN or static host</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 mt-1">✓</span>
              <span>Lower hosting costs with no server required</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
