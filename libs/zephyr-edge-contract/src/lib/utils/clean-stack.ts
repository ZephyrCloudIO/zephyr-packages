// https://github.com/sindresorhus/escape-string-regexp
// https://github.com/sindresorhus/clean-stack

import { homedir } from 'node:os';

const extractPathRegex = /\s+at.*[(\s](.*)\)?/;
const pathRegex =
  /^(?:(?:(?:node|node:[\w/]+|(?:(?:node:)?internal\/[\w/]*|.*node_modules\/(?:babel-polyfill|pirates)\/.*)?\w+)(?:\.js)?:\d+:\d+)|native)/;

type Options = {
  pretty?: boolean;
  basePath?: string;
  pathFilter?: (path: string) => boolean;
};

function escapeStringRegexp(string: string) {
  if (typeof string !== 'string') {
    throw new TypeError('Expected a string');
  }

  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');
}

export function cleanStack(stack: string, { pretty = false, basePath = process.cwd(), pathFilter }: Options = {}) {
  const basePathRegex = basePath && new RegExp(`(file://)?${escapeStringRegexp(basePath.replace(/\\/g, '/'))}/?`, 'g');
  const homeDirectory = pretty ? homedir().replace(/\\/g, '/') : '';

  return stack
    .replace(/\\/g, '/')
    .split('\n')
    .filter((line) => {
      const pathMatches = line.match(extractPathRegex);

      if (pathMatches === null || !pathMatches[1]) {
        return true;
      }

      const match = pathMatches[1];

      return pathFilter ? !pathRegex.test(match) && pathFilter(match) : !pathRegex.test(match);
    })
    .filter((line) => line.trim() !== '')
    .map((line) => {
      if (basePathRegex) {
        line = line.replace(basePathRegex, '');
      }

      if (pretty) {
        line = line.replace(extractPathRegex, (m, p1) => m.replace(p1, p1.replace(homeDirectory, '~')));
      }

      return line;
    })
    .join('\n');
}
