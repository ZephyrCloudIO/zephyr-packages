import ClientCounter from '../components/ClientCounter';
import ServerTime from '../components/ServerTime';

export default function About() {
  return (
    <div>
      <h1>About Page</h1>
      <p>This is the about page with mixed components.</p>
      <ClientCounter />
      <ServerTime />
    </div>
  );
}