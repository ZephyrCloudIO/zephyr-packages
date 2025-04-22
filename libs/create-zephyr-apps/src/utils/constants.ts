const REPO_OWNER = 'ZephyrCloudIO';
const REPO_NAME = 'zephyr-examples';
const REPACK_REPO = 'zephyr-repack-example';

const BASE_REPO = `${REPO_OWNER}/${REPO_NAME}`;

const REPACK_REPO_PATH = `${REPO_OWNER}/${REPACK_REPO}`;

const TEMPLATES = {
  'rspack-project': {
    label: 'React + Rspack',
    hint: 'A simple application build by Rspack.',
    framework: 'react',
  },
  'react-vite-ts': {
    label: 'A simple React application build by Vite',
    hint: 'You will be building React app powered by Vite.',
    framework: 'react',
  },
  'react-vite-mf': {
    label: 'React + Vite + Webpack + Rspack',
    hint: 'You will be building federated React apps powered by Vite, Webpack and Rspack.',
    framework: 'react',
  },
  'angular-vite': {
    label: 'Angular app with Vite',
    hint: 'You will be building an Angular app powered by Vite.',
    framework: 'angular',
  },
  'react-webpack-mf': {
    label: 'React + Webpack',
    hint: 'A React application with Module Federation, using Webpack as the bundler.',
    framework: 'react',
  },
  'nx-rspack-mf': {
    label: 'React + Nx + Rspack',
    hint: 'A React application with Module Federation, using Nx as Monorepo manager and Rspack as the bundler.',
    framework: 'react',
  },
  'nx-webpack-mf': {
    label: 'React + Nx + Webpack',
    hint: 'React applications with Module Federation, using Nx as Monorepo manager and Webpack as the bundler.',
    framework: 'react',
  },
  'ng-nx': {
    label: 'Angular app with Nx',
    hint: 'An Angular application with Nx as Monorepo manager.',
    framework: 'angular',
  },
  'qwik-1.5': {
    label: 'Qwik + Vite',
    hint: 'A Qwik v1.5 app using Vite as the bundler.',
    framework: 'qwik',
  },
  'react-rspack-tractor-2.0': {
    label: 'React + Rspack + Tractor 2.0',
    hint: 'A React application using Rspack as the bundler and Tractor 2.0 as the module federation manager.',
    framework: 'react',
  },
  'turbo-rspack-mf': {
    label: 'Turbo + Rspack + Module Federation',
    hint: 'A monorepo using Turborepo, React, and Rspack as the bundler.',
    framework: 'react',
  },
  'modernjs-app': {
    label: 'ModernJS',
    hint: 'A simple ModernJS app.',
    framework: 'react',
  },
  'rolldown-react': {
    label: 'React + Rolldown',
    hint: 'A React example using Rolldown.',
    framework: 'react',
  },
};

export { REPO_OWNER, REPO_NAME, REPACK_REPO, BASE_REPO, REPACK_REPO_PATH, TEMPLATES };
