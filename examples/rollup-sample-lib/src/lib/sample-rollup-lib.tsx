import { Link, Route, Routes } from 'react-router-dom';

export interface SampleRollupLibProps {}

export function SampleRollupLib(_props: SampleRollupLibProps) {
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
      <Routes>
        <Route
          path="/"
          element={
            <div>
              This is the examples/rollup-sample-lib/src/lib/rollup-sample-lib
              root route.
            </div>
          }
        />
      </Routes>
    </div>
  );
}

export default SampleRollupLib;
