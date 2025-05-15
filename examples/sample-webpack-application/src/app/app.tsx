// eslint-disable-next-line @typescript-eslint/no-unused-vars
import NxWelcome from './nx-welcome';
const test = process.env.ZE_ENVIRONMENT || 'development';
export function App() {
  const title = process.env.ZE_ENV_TITLE || 'Fallback Title';
  const description = process.env.ZE_ENV_DESCRIPTION || 'Fallback Description';

  return (
    <div>
      <h1>Welcome to sample-react-app!</h1>
      <h2>Environment: {test}</h2>
      <NxWelcome title="sample-react-app" />
    </div>
  );
}

export default App;
