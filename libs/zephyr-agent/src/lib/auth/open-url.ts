import type openBrowser from 'open';

/**
 * Opens the given URL in the default browser. Kept in its own module so tests can replace
 * it without launching a real browser.
 */
export async function openUrl(url: string): Promise<void> {
  // Lazy loads `open` module
  // oxlint-disable-next-line no-eval -- Preserve native import() in CommonJS output for ESM-only `open`.
  const openModule = (await eval(`import('open')`)) as {
    default: typeof openBrowser;
  };
  await openModule.default(url);
}
