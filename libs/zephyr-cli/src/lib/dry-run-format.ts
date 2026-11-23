import type { DeployDryRunResult } from '../commands/deploy';

/** Human-readable size, for example `1.5 KiB`. Exact bytes are printed next to it. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/** Text report for `deploy --dry-run`. */
export function formatDryRun(result: DeployDryRunResult): string {
  const lines: string[] = [
    `Dry run: nothing is uploaded. Upload root: ${result.root}`,
    '',
  ];

  lines.push(`Files to upload (${result.fileCount}):`);
  for (const file of result.files) {
    lines.push(`  ${file.path}  ${formatSize(file.size)} (${file.size} bytes)`);
  }

  if (result.excluded.length > 0) {
    lines.push('', `Excluded (${result.excluded.length}):`);
    for (const file of result.excluded) {
      lines.push(`  ${file.path}  ${file.reason}: ${file.rule}`);
    }
  }

  lines.push(
    '',
    `Total: ${result.fileCount} files, ${formatSize(result.totalSize)} (${result.totalSize} bytes)`
  );
  return `${lines.join('\n')}\n`;
}
