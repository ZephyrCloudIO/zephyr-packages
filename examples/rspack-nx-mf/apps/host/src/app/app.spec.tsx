import { rs as jest } from '@rstest/core';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

import App from './app';

jest.mock('react-router-dom', () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Routes: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Route: ({ path, element }: { path?: string; element: ReactNode }) =>
    path === '/' ? <>{element}</> : null,
}));

jest.mock(
  'rspack_nx_mf_remote/Module',
  () => ({
    __esModule: true,
    default: () => <div>Mocked Remote</div>,
  }),
  { virtual: true }
);

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<App />);
    expect(baseElement).toBeTruthy();
  });

  it('should render host welcome content', () => {
    const { getByText } = render(<App />);
    expect(getByText('Host Application')).toBeTruthy();
  });
});
