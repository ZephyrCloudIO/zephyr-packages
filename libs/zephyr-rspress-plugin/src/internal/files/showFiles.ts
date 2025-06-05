import fs from 'node:fs/promises';
import path from 'node:path';
import { ze_log } from 'zephyr-agent';

export async function showFiles(dir: string, files: string[]): Promise<void> {
  if (files.length === 0) {
    ze_log.package('No files found in output directory.');
    return;
  }

  const statTasks = files.map(async (rel) => {
    const abs = path.join(dir, rel);
    try {
      const stats = await fs.stat(abs);
      const sizeKB = (stats.size / 1024).toFixed(2);
      ze_log.package(`${rel} — ${sizeKB} KB`);
    } catch {
      ze_log.package(`Failed to stat file: ${rel}`);
    }
  });

  await Promise.all(statTasks);
}
