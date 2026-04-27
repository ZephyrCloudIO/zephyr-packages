import { rs as jest } from '@rstest/core';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import App from './app';

jest.mock(
  'rspack_nx_mf_remote/Module',
  () => ({
    __esModule: true,
    default: () => <div>Mocked Remote</div>,
  }),
  { virtual: true }
);

function renderApp() {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
}

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = renderApp();
    expect(baseElement).toBeTruthy();
  });

  it('should render host welcome content', () => {
    const { getByText } = renderApp();
    expect(getByText('Host Application')).toBeTruthy();
  });
});
