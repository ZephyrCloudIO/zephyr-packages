// eslint-disable-next-line @typescript-eslint/no-unused-vars
import styles from './app.module.css';

import NxWelcome from './nx-welcome';

export function App() {
  const title = window.__ENV__?.ZE_ENV_TITLE || 'Fallback Title';
  const description =
    window.__ENV__?.ZE_ENV_DESCRIPTION || 'Fallback Description';

  return (
    <div>
      <NxWelcome title={title} />
      <p>{description}</p>
    </div>
  );
}

export default App;
