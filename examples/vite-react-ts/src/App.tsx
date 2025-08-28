import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';

/*
ZE_PUBLIC_SECRET="ze_secret value"
ZE_TEST_PUBLIC="ze_test value"
VITE_TESTING="None ZE variable"
*/

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <div>
        <p>ZE_PUBLIC_SECRET: {import.meta.env.ZE_PUBLIC_SECRET}</p>
        <p>ZE_TEST_PUBLIC: {import.meta.env.ZE_TEST_PUBLIC}</p>
        <p>VITE_TESTING: {import.meta.env.VITE_TESTING}</p>
      </div>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
