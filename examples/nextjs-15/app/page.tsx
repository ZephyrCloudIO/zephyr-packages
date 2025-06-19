import ClientCounter from './components/ClientCounter';
import ClientForm from './components/ClientForm';
import ServerTime from './components/ServerTime';
import ServerData from './components/ServerData';

export default function Home() {
  return (
    <div>
      <h1>Next.js 15 Example</h1>
      <p>This example demonstrates client and server components.</p>
      
      <nav>
        <a href="/about">About</a> | <a href="/contact">Contact</a>
      </nav>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        <ClientCounter />
        <ServerTime />
        <ClientForm />
        <ServerData />
      </div>
    </div>
  );
}
