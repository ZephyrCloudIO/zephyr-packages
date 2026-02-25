import { useEffect, useState } from 'react';
import Stories from './components/Stories';
import fetchData from './lib/fetch-data';

export default function App() {
  const [storyIds, setStoryIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData('topstories').then((ids: number[]) => {
      setStoryIds(ids);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div style={{ padding: 20 }}>Loading stories...</div>;
  }

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <h1>Stories Remote (standalone)</h1>
      <p style={{ color: '#666', fontSize: 14 }}>
        This is the remote app running independently. The Stories component below
        is exposed via Module Federation.
      </p>
      <hr />
      <Stories storyIds={storyIds} page={1} />
    </div>
  );
}
