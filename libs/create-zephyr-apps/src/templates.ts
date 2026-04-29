export const ProjectTypes = [
  {
    value: 'web',
    label: 'Web',
    hint: 'You will be choosing from a selection of templates provided by us.',
  },
  {
    value: 'react-native',
    label: 'React Native',
    hint: 'This is a comprehensive example project provided by us. You will be building React Native powered by Re.Pack.',
  },
];

export type Template = {
  name: string;
  label: string;
  hint: string;
  directory: string;
};

// TODO: Programmatically load templates from the examples repo after cloning it
export const Templates: Template[] = [
  // Bundlers
  {
    name: 'react-vite',
    label: 'React + Vite',
    hint: 'You will be building React app powered by Vite.',
    directory: 'bundlers',
  },
  {
    name: 'react-rspack',
    label: 'React + Rspack',
    hint: 'A simple React application built by Rspack.',
    directory: 'bundlers',
  },
  {
    name: 'parcel-react',
    label: 'React + Parcel',
    hint: 'A React application using Parcel as the bundler.',
    directory: 'bundlers',
  },
  {
    name: 'rolldown-react',
    label: 'React + Rolldown',
    hint: 'A React example using Rolldown.',
    directory: 'bundlers',
  },
  {
    name: 'rollup-react',
    label: 'React + Rollup',
    hint: 'A React application using Rollup as the bundler.',
    directory: 'bundlers',
  },
  {
    name: 'tsdown',
    label: 'React + tsdown',
    hint: 'A React component library starter with tsdown.',
    directory: 'bundlers',
  },
  // Module Federation
  {
    name: 'airbnb-clone',
    label: 'Airbnb clone',
    hint: 'You will be building an Airbnb clone with React, TypeScript, and Module Federation.',
    directory: 'module-federation',
  },
  {
    name: 'react-rsbuild',
    label: 'React + Rsbuild + Module Federation',
    hint: 'A React application with Module Federation using Rsbuild.',
    directory: 'module-federation',
  },
  {
    name: 'react-vite-rspack-webpack',
    label: 'React + Vite + Webpack + Rspack',
    hint: 'You will be building federated React apps powered by Vite, Webpack and Rspack.',
    directory: 'module-federation',
  },
  {
    name: 'react-webpack',
    label: 'React + Webpack + Module Federation',
    hint: 'A React application with Module Federation using Webpack.',
    directory: 'module-federation',
  },
  {
    name: 'tractor-sample',
    label: 'Tractor Store (Module Federation)',
    hint: 'A micro-frontend sample with Rspack and Module Federation.',
    directory: 'module-federation',
  },
  // Frameworks
  {
    name: 'angular-vite',
    label: 'Angular + Vite',
    hint: 'You will be building an Angular app powered by Vite.',
    directory: 'frameworks',
  },
  {
    name: 'astro',
    label: 'Astro',
    hint: 'An Astro static site generator example.',
    directory: 'frameworks',
  },
  {
    name: 'ember-vite',
    label: 'Ember + Vite',
    hint: 'An Ember application using Vite as the bundler.',
    directory: 'frameworks',
  },
  {
    name: 'modernjs',
    label: 'ModernJS',
    hint: 'A simple ModernJS app.',
    directory: 'frameworks',
  },
  {
    name: 'rspress',
    label: 'Rspress SSG',
    hint: 'An Rspress static site generator example.',
    directory: 'frameworks',
  },
  {
    name: 'solid-vite',
    label: 'Solid + Vite',
    hint: 'A Solid app using Vite as the bundler.',
    directory: 'frameworks',
  },
  {
    name: 'svelte-vite',
    label: 'Svelte + Vite',
    hint: 'A Svelte app using Vite as the bundler.',
    directory: 'frameworks',
  },
  {
    name: 'tanstack-start',
    label: 'TanStack Start',
    hint: 'A TanStack Start application with Vite.',
    directory: 'frameworks',
  },
  // Server
  {
    name: 'nitro-hono',
    label: 'Nitro + Hono',
    hint: 'Hono running on Nitro server with Zephyr Cloud deployment.',
    directory: 'server',
  },
  {
    name: 'nitro-elysia',
    label: 'Nitro + Elysia',
    hint: 'Elysia running on Nitro server with Zephyr Cloud deployment.',
    directory: 'server',
  },
  {
    name: 'nitro-hello-world',
    label: 'Nitro Hello World',
    hint: 'Minimal Nitro server with Zephyr Cloud deployment.',
    directory: 'server',
  },
  // Build Systems
  {
    name: 'nx-rspack-mf',
    label: 'NX + React + Rspack + Module Federation',
    hint: 'A monorepo using NX, React, and Rspack with Module Federation.',
    directory: 'build-systems',
  },
  {
    name: 'turborepo-rspack-mf',
    label: 'Turbo + Rspack + Module Federation',
    hint: 'A monorepo using Turborepo, React, and Rspack with Module Federation.',
    directory: 'build-systems',
  },
].sort((a, b) => a.name.localeCompare(b.name));
