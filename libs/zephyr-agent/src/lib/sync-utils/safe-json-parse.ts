export function safe_json_parse<T = Record<string, unknown>>(
  str: string
): T | undefined {
  try {
    return JSON.parse(str);
  } catch {
    return;
  }
}
