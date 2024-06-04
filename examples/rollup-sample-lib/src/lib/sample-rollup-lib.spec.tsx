import { render } from '@testing-library/react';

import SampleRollupLib from './sample-rollup-lib';

describe('SampleRollupLib', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<SampleRollupLib />);
    expect(baseElement).toBeTruthy();
  });
});
