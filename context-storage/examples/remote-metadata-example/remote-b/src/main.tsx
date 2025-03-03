import React from 'react'
import ReactDOM from 'react-dom/client'
import Button from './components/Button.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Remote B - Vite CSR Application</h1>
      <p>This is a standalone version of the Button component that will be federated to the host application.</p>
      <div style={{ marginTop: '20px' }}>
        <Button text="Click me from Remote B!" onClick={() => alert('Button clicked in standalone mode!')} />
      </div>
    </div>
  </React.StrictMode>,
)