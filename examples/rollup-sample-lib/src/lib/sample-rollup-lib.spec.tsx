import { afterEach, describe, expect, it } from '@rstest/core';

import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SampleRollupLib from './sample-rollup-lib';

afterEach(cleanup);

describe('SampleRollupLib', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <MemoryRouter>
        <SampleRollupLib />
      </MemoryRouter>
    );
    expect(baseElement).toBeTruthy();
  });
});
