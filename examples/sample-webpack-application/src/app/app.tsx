import Welcome from './welcome';

import styles from './app.module.css';

export function App() {
  return (
    <div className={styles['app']}>
      <Welcome title="sample-webpack-application" />
    </div>
  );
}

export default App;
