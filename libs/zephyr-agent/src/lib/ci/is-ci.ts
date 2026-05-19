export function isCI(): boolean {
  return Boolean(process.env['CI']);
}
