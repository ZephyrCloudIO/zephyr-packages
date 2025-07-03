export const DependencyFields = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

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

// TODO: Programmatically load templates from the examples repo after cloning it
export const Templates: { name: string; label: string; hint: string }[] = [
  {
    name: 'angular-vite',
    label: 'Angular app with Vite',
    hint: 'You will be building an Angular app powered by Vite.',
  },
  {
    name: 'react-airbnb-clone',
    label: 'Airbnb clone',
    hint: 'A React Airbnb clone with Module Federation.',
  },
  {
    name: 'modernjs-app',
    label: 'ModernJS',
    hint: 'A simple ModernJS app.',
  },
  {
    name: 'qwik-1.5',
    label: 'Qwik + Vite',
    hint: 'A Qwik v1.5 app using Vite as the bundler.',
  },
  {
    name: 'react-rspack-tractor-2.0',
    label: 'React + Rspack + Tractor 2.0',
    hint: 'A React application using Rspack as the bundler and Tractor 2.0 as the module federation manager.',
  },
  {
    name: 'react-vite-mf',
    label: 'React + Vite + Webpack + Rspack',
    hint: 'You will be building federated React apps powered by Vite, Webpack and Rspack.',
  },
  {
    name: 'vite-react-ts',
    label: 'A simple React application build by Vite',
    hint: 'You will be building React app powered by Vite.',
  },
  {
    name: 'rolldown-react',
    label: 'React + Rolldown',
    hint: 'A React example using Rolldown.',
  },
  {
    name: 'rspack-project',
    label: 'React + Rspack',
    hint: 'A simple application build by Rspack.',
  },
  {
    name: 'solid',
    label: 'Solid + Vite',
    hint: 'A Solid app using Vite as the bundler.',
  },
  {
    name: 'svelte',
    label: 'Svelte + Vite',
    hint: 'A Svelte app using Vite as the bundler.',
  },
  {
    name: 'turbo-rspack-mf',
    label: 'Turbo + Rspack + Module Federation',
    hint: 'A monorepo using Turborepo, React, and Rspack as the bundler.',
  },
].sort((a, b) => a.name.localeCompare(b.name));
