// plugin-track-ssg-assets.ts
import type { RspressPlugin } from '@rspress/shared';
import fs from 'node:fs/promises';
import path from 'node:path';
import { withZephyr } from 'zephyr-rsbuild-plugin';

export function pluginTrackSSGAssets(): RspressPlugin {
  return {
    name: 'plugin-track-ssg-assets',
    async afterBuild(config) {
      const outDir = path.resolve(config.outDir || 'doc_build');

      async function walk(dir: string, prefix = ''): Promise<string[]> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files: string[] = [];

        for (const entry of entries) {
          const rel = path.join(prefix, entry.name);
          const full = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            files.push(...await walk(full, rel));
          } else {
            files.push(rel);
          }
        }

        return files;
      }

      const allFiles = await walk(outDir);

      if (allFiles.length === 0) {
        console.log('⚠️ No files found in output directory.');
        return;
      }

      console.log(`\n📦 Files from this build:`);

      for (const rel of allFiles) {
        const abs = path.join(outDir, rel);
        try {
          const stats = await fs.stat(abs);
          const sizeKB = (stats.size / 1024).toFixed(2);
          console.log(`📄 ${rel} — ${sizeKB} KB`);
        } catch {
          // skip errors
        }
      }

      console.log('\n🚀 Sending files with Zephyr...');

      await withZephyr({
        root: outDir,
        files: allFiles,
        meta: {
          from: 'rspress-ssg',
          timestamp: new Date().toISOString(),
        },
      });

      console.log(`✅ Zephyr: sent ${allFiles.length} files.`);
    },
  };
}
