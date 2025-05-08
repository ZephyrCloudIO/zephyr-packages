import fs from 'node:fs/promises';
import path from 'node:path';

export async function showFiles(dir: string, files: string[]): Promise<void> {
  if (files.length === 0) {
    console.warn('No files found in output directory.');
    return;
  }

  const statTasks = files.map(async (rel) => {
    const abs = path.join(dir, rel);
    try {
      const stats = await fs.stat(abs);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`${rel} — ${sizeKB} KB`);
    } catch {
      console.warn(`Failed to stat file: ${rel}`);
    }
  });

  await Promise.all(statTasks);
}
