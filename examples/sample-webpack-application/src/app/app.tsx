// eslint-disable-next-line @typescript-eslint/no-unused-vars

/*#__DYNAMIC__*/
import { Cond } from './cond';
/*#__DYNAMIC__*/
import { log } from './logger';
import NxWelcome from './nx-welcome';

function Wrapper() {
  if (process.env.ZE_PUBLIC_LOG) {
    log('Wrapper');
  }

  if (process.env.ZE_PUBLIC_COND) {
    return <Cond />;
  }
  return null;
}

export function App() {
  if (process.env.ZE_PUBLIC_LOG) {
    log('App');
  }

  return (
    <div>
      <Wrapper />

      <NxWelcome title="sample-react-app" />
    </div>
  );
}

export default App;
