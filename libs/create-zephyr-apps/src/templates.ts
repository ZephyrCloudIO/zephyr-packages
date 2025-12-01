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
  // Vanilla examples
  {
    name: 'astro',
    label: 'Astro',
    hint: 'An Astro static site generator example.',
    directory: 'vanilla' as const,
  },
  {
    name: 'mf-airbnb-clone',
    label: 'Airbnb clone',
    hint: 'You will be building an Airbnb clone with React, TypeScript, and Module Federation.',
    directory: 'vanilla' as const,
  },
  {
    name: 'mf-react-rsbuild',
    label: 'React + Rsbuild + Module Federation',
    hint: 'A React application with Module Federation using Rsbuild.',
    directory: 'vanilla' as const,
  },
  {
    name: 'mf-react-vite-rspack-webpack',
    label: 'React + Vite + Webpack + Rspack',
    hint: 'You will be building federated React apps powered by Vite, Webpack and Rspack.',
    directory: 'vanilla' as const,
  },
  {
    name: 'mf-react-webpack',
    label: 'React + Webpack + Module Federation',
    hint: 'A React application with Module Federation using Webpack.',
    directory: 'vanilla' as const,
  },
  {
    name: 'mf-tractor-sample',
    label: 'React + Webpack + Tractor',
    hint: 'A React application using Webpack as the bundler and Tractor as the module federation manager.',
    directory: 'vanilla' as const,
  },
  {
    name: 'modernjs',
    label: 'ModernJS',
    hint: 'A simple ModernJS app.',
    directory: 'vanilla' as const,
  },
  {
    name: 'parcel-react',
    label: 'React + Parcel',
    hint: 'A React application using Parcel as the bundler.',
    directory: 'vanilla' as const,
  },
  {
    name: 'rolldown-react',
    label: 'React + Rolldown',
    hint: 'A React example using Rolldown.',
    directory: 'vanilla' as const,
  },
  {
    name: 'rollup-react',
    label: 'React + Rollup',
    hint: 'A React application using Rollup as the bundler.',
    directory: 'vanilla' as const,
  },
  {
    name: 'rspack-react',
    label: 'React + Rspack',
    hint: 'A simple React application built by Rspack.',
    directory: 'vanilla' as const,
  },
  {
    name: 'rspress',
    label: 'Rspress SSG',
    hint: 'An Rspress static site generator example.',
    directory: 'vanilla' as const,
  },
  {
    name: 'vite-angular',
    label: 'Angular + Vite',
    hint: 'You will be building an Angular app powered by Vite.',
    directory: 'vanilla' as const,
  },
  {
    name: 'vite-ember',
    label: 'Ember + Vite',
    hint: 'An Ember application using Vite as the bundler.',
    directory: 'vanilla' as const,
  },
  {
    name: 'vite-react',
    label: 'React + Vite',
    hint: 'You will be building React app powered by Vite.',
    directory: 'vanilla' as const,
  },
  {
    name: 'vite-solid',
    label: 'Solid + Vite',
    hint: 'A Solid app using Vite as the bundler.',
    directory: 'vanilla' as const,
  },
  {
    name: 'vite-svelte',
    label: 'Svelte + Vite',
    hint: 'A Svelte app using Vite as the bundler.',
    directory: 'vanilla' as const,
  },
  // NX examples
  {
    name: 'mf-nx-rspack',
    label: 'NX + React + Rspack + Module Federation',
    hint: 'A monorepo using NX, React, and Rspack with Module Federation.',
    directory: 'nx' as const,
  },
  // Turborepo examples
  {
    name: 'mf-turbo-rspack',
    label: 'Turbo + Rspack + Module Federation',
    hint: 'A monorepo using Turborepo, React, and Rspack with Module Federation.',
    directory: 'turborepo' as const,
  },
].sort((a, b) => a.name.localeCompare(b.name));
