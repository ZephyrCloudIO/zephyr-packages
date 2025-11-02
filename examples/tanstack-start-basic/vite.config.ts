import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { withZephyrTanstackStart } from 'vite-plugin-tanstack-start-zephyr'

const config = defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    // Zephyr deployment plugin - auto-detects configuration from package.json and git
    withZephyrTanstackStart(),
  ],
})

export default config
