import { Route, Link } from 'react-router-dom';

import styles from './sample-rollup-lib.module.css';

/* eslint-disable-next-line */
export interface SampleRollupLibProps {}

export function SampleRollupLib(props: SampleRollupLibProps) {
  return (
    <div className={styles['container']}>
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
