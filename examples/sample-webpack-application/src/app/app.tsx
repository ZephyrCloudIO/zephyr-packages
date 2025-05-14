// eslint-disable-next-line @typescript-eslint/no-unused-vars
import NxWelcome from './nx-welcome';

export function App() {
  const title = process.env.ZE_ENV_TITLE || 'Fallback Title';
  const description = process.env.ZE_ENV_DESCRIPTION || 'Fallback Description';

  return (
    <div>
      <NxWelcome title={title} />
      <p>{description}</p>
    </div>
  );
}

export default App;
