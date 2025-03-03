import React from 'react';
import Card from './components/Card';

const App: React.FC = () => {
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Remote C - Webpack Application</h1>
      <p>This is a standalone version of the Card component that will be federated to the host application.</p>
      <div style={{ marginTop: '20px' }}>
        <Card title="Sample Card">
          <p>This is a card component from Remote C.</p>
          <p>It demonstrates metadata sharing with the host application.</p>
        </Card>
      </div>
    </div>
  );
};

export default App;