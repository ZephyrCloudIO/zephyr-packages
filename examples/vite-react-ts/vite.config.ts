import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import { withZephyr } from 'vite-plugin-zephyr';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: 'wwwroot',
  },
  plugins: [
    react(),
    //  Inspect({ build: true, outputDir: 'dist/.vite-inspect' }),
    withZephyr(),
    zeEnvVarsPlugin()
  ],
});

function zeEnvVarsPlugin(): Plugin {
  const usedVars = new Set<string>()
  const virtualId = 'virtual:ze-env'
  const resolvedVirtualId = '\0' + virtualId

  return {
    name: 'ze-env-vars',
    enforce: 'pre',

    transform(code, id) {
      if (!/\.(js|ts|jsx|tsx|vue)$/.test(id)) return

      let transformed = code
      let needsImport = false

      // import.meta.env.ASD
      transformed = transformed.replace(/\bimport\.meta\.env\.(ZE_[a-zA-Z0-9_]+)/g, (_, name) => {
        usedVars.add(name)
        needsImport = true
        return `ZE_ENV.${name}`
      })

      // import.meta.env["ASD"]
      transformed = transformed.replace(/\bimport\.meta\.env\[['"`](ZE_[a-zA-Z0-9_]+)['"`]\]/g, (_, name) => {
        usedVars.add(name)
        needsImport = true
        return `ZE_ENV.${name}`
      })

      if (needsImport) {
        transformed = `import { ZE_ENV } from '${virtualId}';\n` + transformed
      }

      return {
        code: transformed,
        map: null
      }
    },

    resolveId(id) {
      if (id === virtualId) return resolvedVirtualId
    },

    load(id) {
      if (id === resolvedVirtualId) {
        const env: Record<string, string> = {}
        for (const key of usedVars) {
            env[key] = `(That's a fake value for ${key})`
        }
        return `export const ZE_ENV = ${JSON.stringify(env, null, 2)};`
      }
    },

    outputOptions(outputOptions) {
      outputOptions.manualChunks = (id: string) => {
        if (id === resolvedVirtualId) {
          return 'ze-env'
        }
      }
      return outputOptions
    }
  }
}