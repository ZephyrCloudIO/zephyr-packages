import { afterEach, describe, expect, it } from '@rstest/core';

import { cleanup, render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import App from './app';

afterEach(cleanup);

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(baseElement).toBeTruthy();
  });

  it('should have a greeting as the title', () => {
    const { getAllByText } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(getAllByText(new RegExp('Welcome host', 'gi')).length > 0).toBeTruthy();
  });
});
