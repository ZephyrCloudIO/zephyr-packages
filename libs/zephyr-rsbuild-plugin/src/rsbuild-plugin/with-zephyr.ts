import { ZephyrEngine } from 'zephyr-agent';
import path from 'node:path';
import fs from 'node:fs/promises';
import { xpack_zephyr_agent } from 'zephyr-xpack-internal';

export interface WithZephyrOptions {
  root: string;
  files: string[];
  meta?: Record<string, any>;
}

export async function withZephyr(options: WithZephyrOptions): Promise<void> {
  const { root, files, meta } = options;

  const engine = await ZephyrEngine.create({
    builder: 'rspack',
    context: path.resolve(root),
  });

  await engine.start_new_build();

  const assets: Record<string, { source: () => Buffer }> = {};
  for (const rel of files) {
    const abs = path.join(root, rel);
    const content = await fs.readFile(abs);
    assets[rel] = {
      source: () => content,
    };
  }

  const stats = {
    compilation: {
      options: {
        context: root,
      },
    },
    toJson: () => ({
      assets: files.map((f) => ({ name: f })),
    }),
  };

  const pluginOptions = {
    pluginName: 'plugin-track-ssg-assets',
    wait_for_index_html: false,
    zephyr_engine: engine,
    options: {
      name: 'rspress-ssg',
      root,
      files,
      meta,
      federation: {
        name: '',
        remotes: {},
        exposes: {},
        shared: {},
      },
    },
  };

  process.nextTick(xpack_zephyr_agent, {
    stats,
    stats_json: stats.toJson(),
    assets,
    pluginOptions,
  });
}
