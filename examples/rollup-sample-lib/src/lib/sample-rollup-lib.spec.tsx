import { afterEach, describe, expect, it, rs } from '@rstest/core';

import { cleanup, render } from '@testing-library/react';
import SampleRollupLib from './sample-rollup-lib';

rs.mock('react-router-dom', () => ({
  Link: ({ children }: { children: unknown }) => children,
  Route: ({ element }: { element: unknown }) => element,
}));

afterEach(cleanup);

describe('SampleRollupLib', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<SampleRollupLib />);
    expect(baseElement).toBeTruthy();
  });
});
