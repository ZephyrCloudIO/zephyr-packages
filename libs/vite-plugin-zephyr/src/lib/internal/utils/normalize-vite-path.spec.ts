import { describe, expect, it } from '@rstest/core';

import { normalizeVitePath } from './normalize-vite-path';

describe('normalizeVitePath', () => {
  it('normalizes Windows and mixed separators independently of the host OS', () => {
    expect(normalizeVitePath('assets\\nested\\app.js')).toBe('assets/nested/app.js');
    expect(normalizeVitePath('assets\\nested/icon.svg')).toBe('assets/nested/icon.svg');
  });
});
