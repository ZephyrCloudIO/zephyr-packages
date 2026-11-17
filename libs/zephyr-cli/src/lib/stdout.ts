/**
 * Reserve stdout for a machine-readable result by sending every other stdout write to
 * stderr. Patching the stream rather than `console` also covers writers that bypass it,
 * such as the interactive login prompt's readline interface.
 *
 * @returns A writer for the real stdout. Its promise settles once the text is flushed, so
 *   a caller can exit right after it.
 */
export function reserveStdout(): (text: string) => Promise<void> {
  const writeStdout = process.stdout.write.bind(process.stdout);
  process.stdout.write = process.stderr.write.bind(
    process.stderr
  ) as typeof process.stdout.write;
  return (text) =>
    new Promise((resolve) => {
      writeStdout(text, () => resolve());
    });
}
