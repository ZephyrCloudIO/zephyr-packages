import { useEffect, useState } from 'react';
import Story from './Story';
import fetchData from '../lib/fetch-data';
import { transform } from '../lib/get-item';
import styles from './stories.module.css';

interface StoryData {
  id: number;
  url: string;
  user: string;
  date: number;
  comments: number[];
  commentsCount: number;
  score: number;
  title: string;
}

function StoryWithData({ id }: { id: number }) {
  const [story, setStory] = useState<StoryData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchData(`item/${id}`)
      .then((data) => {
        const transformed = transform(data);
        setStory(transformed as StoryData | null);
      })
      .catch(() => setError(true));
  }, [id]);

  if (error) return <div>Failed to load story</div>;
  if (!story) return <div className={styles.skeleton} />;

  return <Story {...story} />;
}

interface StoriesProps {
  storyIds: number[];
  page?: number;
}

export default function Stories({ storyIds, page = 1 }: StoriesProps) {
  const limit = 30;
  const offset = (page - 1) * limit;

  return (
    <div>
      {storyIds.slice(offset, offset + limit).map((id, i) => (
        <div key={id} className={styles.item}>
          {offset != null ? (
            <span className={styles.count}>{i + offset + 1}</span>
          ) : null}
          <StoryWithData id={id} />
        </div>
      ))}
      <div className={styles.footer}>
        <a href={`/news/${+page + 1}`}>More</a>
      </div>
    </div>
  );
}
