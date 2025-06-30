// eslint-disable-next-line @typescript-eslint/no-unused-vars
import styles from './app.module.css';

import NxWelcome from './nx-welcome';
const test = process.env.ZE_ENVIRONMENT || 'development';
export function App() {
  return (
    <div>
      <h1>Welcome to sample-react-app!</h1>
      <h2>Environment: {test}</h2>
      <NxWelcome title="sample-react-app" />
    </div>
  );
}

export default App;
