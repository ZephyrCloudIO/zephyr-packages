import type { Library } from '../xpack.types';

export function extractLibraryType(library: Library | undefined): string | undefined {
  if (!library) return undefined;

  if (typeof library === 'string') {
    return library;
  }

  if (Array.isArray(library)) {
    return library[0];
  }

  return library.amd ? 'amd' : library.type;
}
