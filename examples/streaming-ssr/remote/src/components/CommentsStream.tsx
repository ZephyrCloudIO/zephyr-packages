import React, { Suspense } from 'react';
import { Comment, StreamingPriority } from 'streaming-ssr-shared/dist/types';
import { fetchComments } from 'streaming-ssr-shared/dist/data';
import { formatRelativeTime } from 'streaming-ssr-shared/dist/utils';

// Simulated fetch delay based on priority
const FETCH_DELAYS: Record<StreamingPriority, number> = {
  critical: 100,
  high: 1500,
  medium: 3000,
  low: 5000
};

interface CommentsStreamProps {
  contentId: string;
  limit?: number;
  priority?: StreamingPriority;
}

// Loading state
function CommentsSkeleton() {
  return (
    <div className="comments-skeleton">
      <div className="comments-skeleton-header">
        <div className="comments-skeleton-title"></div>
        <div className="comments-skeleton-count"></div>
      </div>
      
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="comment-skeleton">
          <div className="comment-skeleton-avatar"></div>
          <div className="comment-skeleton-content">
            <div className="comment-skeleton-author"></div>
            <div className="comment-skeleton-text"></div>
            <div className="comment-skeleton-text short"></div>
          </div>
        </div>
      ))}
      
      <style jsx>{`
        .comments-skeleton {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .comments-skeleton-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .comments-skeleton-title {
          height: 24px;
          width: 120px;
          background-color: #e0e0e0;
          border-radius: 4px;
          animation: pulse 1.5s infinite;
        }
        
        .comments-skeleton-count {
          height: 18px;
          width: 60px;
          background-color: #e0e0e0;
          border-radius: 4px;
          animation: pulse 1.5s infinite;
        }
        
        .comment-skeleton {
          display: flex;
          gap: 12px;
          padding: 16px;
          border-radius: 8px;
          background-color: #f5f5f5;
        }
        
        .comment-skeleton-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: #e0e0e0;
          animation: pulse 1.5s infinite;
        }
        
        .comment-skeleton-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .comment-skeleton-author {
          height: 18px;
          width: 100px;
          background-color: #e0e0e0;
          border-radius: 4px;
          animation: pulse 1.5s infinite;
        }
        
        .comment-skeleton-text {
          height: 16px;
          width: 100%;
          background-color: #e0e0e0;
          border-radius: 4px;
          animation: pulse 1.5s infinite;
        }
        
        .comment-skeleton-text.short {
          width: 70%;
        }
        
        @keyframes pulse {
          0% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}

// Error state
function CommentsError({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="comments-error">
      <h3>Error Loading Comments</h3>
      <p>{error.message}</p>
      <button onClick={retry}>Retry</button>
      <style jsx>{`
        .comments-error {
          padding: 16px;
          border-radius: 8px;
          background-color: #ffecec;
          border: 1px solid #f5c2c2;
          color: #d8000c;
        }
        
        h3 {
          margin-top: 0;
        }
        
        button {
          background-color: #d8000c;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }
        
        button:hover {
          background-color: #b50006;
        }
      `}</style>
    </div>
  );
}

// Individual comment component
function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="comment">
      {comment.authorAvatar ? (
        <div className="comment-avatar">
          <img src={comment.authorAvatar} alt={comment.authorName} />
        </div>
      ) : (
        <div className="comment-avatar default">
          {comment.authorName.charAt(0).toUpperCase()}
        </div>
      )}
      
      <div className="comment-content">
        <div className="comment-header">
          <span className="comment-author">{comment.authorName}</span>
          <span className="comment-date">{formatRelativeTime(comment.createdAt)}</span>
        </div>
        
        <p className="comment-text">{comment.text}</p>
        
        <div className="comment-actions">
          <button className="comment-like">
            <span className="like-icon">♥</span>
            <span className="like-count">{comment.likes}</span>
          </button>
          <button className="comment-reply">Reply</button>
        </div>
        
        {comment.replies && comment.replies.length > 0 && (
          <div className="comment-replies">
            {comment.replies.map(reply => (
              <div key={reply.id} className="comment-reply-item">
                <div className="reply-avatar default">
                  {reply.authorName.charAt(0).toUpperCase()}
                </div>
                <div className="reply-content">
                  <div className="reply-header">
                    <span className="reply-author">{reply.authorName}</span>
                    <span className="reply-date">{formatRelativeTime(reply.createdAt)}</span>
                  </div>
                  <p className="reply-text">{reply.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <style jsx>{`
        .comment {
          display: flex;
          gap: 12px;
          padding: 16px;
          border-radius: 8px;
          background-color: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          margin-bottom: 16px;
        }
        
        .comment-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          overflow: hidden;
        }
        
        .comment-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .comment-avatar.default {
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #1976d2;
          color: white;
          font-weight: bold;
        }
        
        .comment-content {
          flex: 1;
        }
        
        .comment-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        
        .comment-author {
          font-weight: bold;
          color: #333;
        }
        
        .comment-date {
          color: #757575;
          font-size: 12px;
        }
        
        .comment-text {
          margin: 0 0 12px 0;
          color: #424242;
          line-height: 1.5;
        }
        
        .comment-actions {
          display: flex;
          gap: 16px;
        }
        
        .comment-like,
        .comment-reply {
          background: none;
          border: none;
          color: #757575;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          font-size: 14px;
          padding: 4px 0;
        }
        
        .comment-like:hover,
        .comment-reply:hover {
          color: #1976d2;
        }
        
        .like-icon {
          color: #f44336;
          font-size: 16px;
        }
        
        .comment-replies {
          margin-top: 12px;
          padding-left: 16px;
          border-left: 2px solid #e0e0e0;
        }
        
        .comment-reply-item {
          display: flex;
          gap: 8px;
          padding: 12px 0;
        }
        
        .reply-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #9e9e9e;
          color: white;
          font-size: 12px;
          font-weight: bold;
        }
        
        .reply-content {
          flex: 1;
        }
        
        .reply-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        
        .reply-author {
          font-weight: bold;
          font-size: 13px;
          color: #333;
        }
        
        .reply-date {
          color: #757575;
          font-size: 11px;
        }
        
        .reply-text {
          margin: 0;
          color: #424242;
          font-size: 13px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}

// Comments section display
function CommentsDisplay({ comments }: { comments: Comment[] }) {
  return (
    <div className="comments-section">
      <div className="comments-header">
        <h3 className="comments-title">Comments</h3>
        <span className="comments-count">{comments.length} comments</span>
      </div>
      
      <div className="comments-list">
        {comments.length > 0 ? (
          comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        ) : (
          <div className="no-comments">
            No comments yet. Be the first to share your thoughts!
          </div>
        )}
      </div>
      
      <div className="add-comment">
        <h4>Add a Comment</h4>
        <textarea 
          placeholder="Write your comment here..."
          className="comment-input"
        />
        <button className="submit-comment">Post Comment</button>
      </div>
      
      <style jsx>{`
        .comments-section {
          padding: 16px;
          background-color: #f9f9f9;
          border-radius: 8px;
        }
        
        .comments-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .comments-title {
          margin: 0;
          font-size: 20px;
          color: #333;
        }
        
        .comments-count {
          color: #757575;
          font-size: 14px;
        }
        
        .comments-list {
          margin-bottom: 24px;
        }
        
        .no-comments {
          padding: 16px;
          background-color: white;
          border-radius: 8px;
          color: #757575;
          text-align: center;
          font-style: italic;
        }
        
        .add-comment {
          background-color: white;
          padding: 16px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .add-comment h4 {
          margin-top: 0;
          margin-bottom: 12px;
          font-size: 16px;
          color: #333;
        }
        
        .comment-input {
          width: 100%;
          min-height: 100px;
          padding: 12px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          margin-bottom: 12px;
          font-family: inherit;
          resize: vertical;
        }
        
        .submit-comment {
          background-color: #1976d2;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        
        .submit-comment:hover {
          background-color: #1565c0;
        }
      `}</style>
    </div>
  );
}

// Data fetching component
function CommentsData({
  contentId,
  limit = 10,
  priority = 'medium'
}: CommentsStreamProps) {
  // Calculate delay based on priority
  const delay = FETCH_DELAYS[priority];
  
  // Fetch comments with artificial delay
  const commentsPromise = fetchComments(contentId, { 
    limit, 
    delay 
  });
  
  // Suspense will catch this promise
  const comments = use(commentsPromise);
  
  return <CommentsDisplay comments={comments} />;
}

// React 18 use hook for client
function use<T>(promise: Promise<T>): T {
  if (promise.status === 'fulfilled') {
    return promise.value;
  } else if (promise.status === 'rejected') {
    throw promise.reason;
  } else {
    throw promise;
  }
}

// Augment Promise type
declare global {
  interface Promise<T> {
    status?: 'pending' | 'fulfilled' | 'rejected';
    value?: T;
    reason?: any;
  }
}

// Main component with error boundaries
export default function CommentsStream({
  contentId,
  limit = 10,
  priority = 'medium'
}: CommentsStreamProps) {
  const [key, setKey] = React.useState(0);
  const [error, setError] = React.useState<Error | null>(null);
  
  // Handle errors
  const handleError = (error: Error) => {
    setError(error);
  };
  
  // Retry loading
  const handleRetry = () => {
    setError(null);
    setKey(prevKey => prevKey + 1);
  };
  
  // If there's an error, show error UI
  if (error) {
    return <CommentsError error={error} retry={handleRetry} />;
  }
  
  // Streaming comments with skeleton fallback
  return (
    <Suspense fallback={<CommentsSkeleton />}>
      <CommentsData 
        key={key}
        contentId={contentId}
        limit={limit}
        priority={priority}
      />
    </Suspense>
  );
}