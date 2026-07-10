import { afterEach, describe, expect, it } from '@rstest/core';

import { cleanup, render } from '@testing-library/react';

import App from './app';

afterEach(cleanup);

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<App />);
    expect(baseElement).toBeTruthy();
  });

  it('should have a greeting as the title', () => {
    const { getAllByText } = render(<App />);
    expect(getAllByText(new RegExp('Welcome remote', 'gi')).length > 0).toBeTruthy();
  });
});
