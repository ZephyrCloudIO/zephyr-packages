import { useState } from 'react';
import timeAgo from '../lib/time-ago';
import styles from './story.module.css';

interface StoryProps {
  id: number;
  title: string;
  date: number;
  url: string;
  user: string;
  score: number;
  commentsCount: number;
}

export default function Story({
  id,
  title,
  date,
  url,
  user,
  score,
  commentsCount,
}: StoryProps) {
  const { host } = url ? new URL(url) : { host: '#' };
  const [voted, setVoted] = useState(false);

  return (
    <div className={styles.story}>
      <div className={styles.title}>
        <span
          className={voted ? styles['votearrow--voted'] : styles.votearrow}
          onClick={() => setVoted(!voted)}
        >
          &#9650;
        </span>
        <a href={url} rel="noopener noreferrer nofollow" target="_blank">
          {title}
        </a>
        {url && (
          <span className={styles.source}>
            {' ('}
            <a
              href={`http://${host}`}
              rel="noopener noreferrer nofollow"
              target="_blank"
            >
              {host.replace(/^www\./, '')}
            </a>
            {')'}
          </span>
        )}
      </div>
      <div className={styles.meta}>
        {score} {plural(score, 'point')} by <span>{user}</span>{' '}
        <a href={`/item/${id}`}>
          <span>{timeAgo(new Date(date))} ago</span>
        </a>{' '}
        |{' '}
        <a href={`/item/${id}`}>
          {commentsCount} {plural(commentsCount, 'comment')}
        </a>
      </div>
    </div>
  );
}

const plural = (n: number, s: string) => s + (n === 0 || n > 1 ? 's' : '');
