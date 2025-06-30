import './App.css';

const App = () => {
  // Environment variables using import.meta.env syntax
  // Access them directly so they're detected during transformation
  const environment = import.meta.env.ZE_ENVIRONMENT || 'development';
  const deployUrl = import.meta.env.ZE_DEPLOY_URL || 'http://localhost:3000';
  const version = import.meta.env.ZE_VERSION || '1.0.0';
  const appId = import.meta.env.ZE_APP_ID || 'local-app';

  // Log the environment variables for debugging
  console.log('Zephyr Environment Variables:', {
    ZE_ENVIRONMENT: import.meta.env.ZE_ENVIRONMENT,
    ZE_DEPLOY_URL: import.meta.env.ZE_DEPLOY_URL,
    ZE_VERSION: import.meta.env.ZE_VERSION,
    ZE_APP_ID: import.meta.env.ZE_APP_ID,
  });

  return (
    <div className="content">
      <h1>Rsbuild with React</h1>
      <p>Start building amazing things with Rsbuild.</p>

      <div className="env-vars">
        <h2>Zephyr Environment Variables</h2>
        <ul>
          <li>Environment: {environment}</li>
          <li>Deploy URL: {deployUrl}</li>
          <li>Version: {version}</li>
          <li>App ID: {appId}</li>
        </ul>
      </div>
    </div>
  );
};

export default App;
