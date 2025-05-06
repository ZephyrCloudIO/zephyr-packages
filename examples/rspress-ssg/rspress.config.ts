// rspress.config.ts
import path from 'node:path';
import { defineConfig } from 'rspress/config';
import { pluginTrackSSGAssets } from './plugin';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  outDir: './doc_build',
  ssg: true,
  plugins: [pluginTrackSSGAssets()],
});
