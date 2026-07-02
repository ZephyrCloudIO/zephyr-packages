import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import SampleRollupLib from './sample-rollup-lib';

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
