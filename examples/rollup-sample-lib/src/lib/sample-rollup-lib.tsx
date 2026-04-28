import { Route, Link } from 'react-router-dom';

/* eslint-disable-next-line */
export interface SampleRollupLibProps {}

export function SampleRollupLib(props: SampleRollupLibProps) {
  return (
    <div>
      <h1>Welcome to SampleRollupLib!</h1>

      <ul>
        <li>
          <Link to="/">
            examples/rollup-sample-lib/src/lib/rollup-sample-lib root
          </Link>
        </li>
      </ul>
      <Route
        path="/"
        element={
          <div>
            This is the examples/rollup-sample-lib/src/lib/rollup-sample-lib
            root route.
          </div>
        }
      />
    </div>
  );
}

export default SampleRollupLib;
