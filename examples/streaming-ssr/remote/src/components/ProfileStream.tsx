import React, { Suspense } from 'react';
import { UserProfile, StreamingPriority } from 'streaming-ssr-shared/dist/types';
import { fetchUserProfile } from 'streaming-ssr-shared/dist/data';
import { formatDate } from 'streaming-ssr-shared/dist/utils';

// Simulated fetch delay based on priority
const FETCH_DELAYS: Record<StreamingPriority, number> = {
  critical: 300,
  high: 1500,
  medium: 3000,
  low: 4500
};

// Additional delay for detailed view
const DETAILED_DELAY_ADDITION = 2000;

interface ProfileStreamProps {
  userId: string;
  detailed?: boolean;
  priority?: StreamingPriority;
}

// Loading state
function ProfileSkeleton({ detailed = false }: { detailed?: boolean }) {
  return (
    <div className="profile-skeleton">
      <div className="profile-skeleton-header">
        <div className="profile-skeleton-avatar"></div>
        <div className="profile-skeleton-info">
          <div className="profile-skeleton-name"></div>
          <div className="profile-skeleton-email"></div>
          <div className="profile-skeleton-join-date"></div>
        </div>
      </div>
      
      {detailed && (
        <div className="profile-skeleton-details">
          <div className="profile-skeleton-section">
            <div className="profile-skeleton-section-title"></div>
            <div className="profile-skeleton-stats">
              <div className="profile-skeleton-stat"></div>
              <div className="profile-skeleton-stat"></div>
              <div className="profile-skeleton-stat"></div>
            </div>
          </div>
          
          <div className="profile-skeleton-section">
            <div className="profile-skeleton-section-title"></div>
            <div className="profile-skeleton-bio"></div>
          </div>
          
          <div className="profile-skeleton-section">
            <div className="profile-skeleton-section-title"></div>
            <div className="profile-skeleton-preferences">
              <div className="profile-skeleton-preference"></div>
              <div className="profile-skeleton-preference"></div>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .profile-skeleton {
          padding: 20px;
          border-radius: 8px;
          background-color: #f9f9f9;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          animation: pulse 1.5s infinite;
        }
        
        .profile-skeleton-header {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
        }
        
        .profile-skeleton-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background-color: #e0e0e0;
        }
        
        .profile-skeleton-info {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
        }
        
        .profile-skeleton-name {
          height: 24px;
          width: 150px;
          background-color: #e0e0e0;
          border-radius: 4px;
        }
        
        .profile-skeleton-email {
          height: 16px;
          width: 200px;
          background-color: #e0e0e0;
          border-radius: 4px;
        }
        
        .profile-skeleton-join-date {
          height: 14px;
          width: 120px;
          background-color: #e0e0e0;
          border-radius: 4px;
        }
        
        .profile-skeleton-details {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .profile-skeleton-section {
          padding: 15px;
          background-color: white;
          border-radius: 6px;
        }
        
        .profile-skeleton-section-title {
          height: 18px;
          width: 100px;
          background-color: #e0e0e0;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        
        .profile-skeleton-stats {
          display: flex;
          justify-content: space-between;
        }
        
        .profile-skeleton-stat {
          height: 40px;
          width: 30%;
          background-color: #e0e0e0;
          border-radius: 4px;
        }
        
        .profile-skeleton-bio {
          height: 80px;
          background-color: #e0e0e0;
          border-radius: 4px;
        }
        
        .profile-skeleton-preferences {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .profile-skeleton-preference {
          height: 30px;
          background-color: #e0e0e0;
          border-radius: 4px;
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
function ProfileError({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="profile-error">
      <h3>Error Loading Profile</h3>
      <p>{error.message}</p>
      <button onClick={retry}>Retry</button>
      <style jsx>{`
        .profile-error {
          padding: 20px;
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

// Stats card
function StatsCard({ 
  title, 
  value, 
  icon 
}: { 
  title: string; 
  value: number; 
  icon: string;
}) {
  return (
    <div className="stats-card">
      <span className="stats-icon">{icon}</span>
      <div className="stats-content">
        <div className="stats-value">{value}</div>
        <div className="stats-title">{title}</div>
      </div>
      <style jsx>{`
        .stats-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background-color: #f5f5f5;
          border-radius: 8px;
        }
        
        .stats-icon {
          font-size: 24px;
          color: #1976d2;
        }
        
        .stats-content {
          display: flex;
          flex-direction: column;
        }
        
        .stats-value {
          font-size: 18px;
          font-weight: bold;
          color: #333;
        }
        
        .stats-title {
          font-size: 14px;
          color: #757575;
        }
      `}</style>
    </div>
  );
}

// Simple profile
function SimpleProfile({ profile }: { profile: UserProfile }) {
  return (
    <div className="profile-simple">
      <div className="profile-header">
        {profile.avatar ? (
          <div className="profile-avatar">
            <img src={profile.avatar} alt={profile.name} />
          </div>
        ) : (
          <div className="profile-avatar default">
            {profile.name.charAt(0).toUpperCase()}
          </div>
        )}
        
        <div className="profile-info">
          <h3 className="profile-name">{profile.name}</h3>
          <div className="profile-email">{profile.email}</div>
          <div className="profile-join-date">
            Member since {formatDate(profile.joinDate)}
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .profile-simple {
          padding: 20px;
          border-radius: 8px;
          background-color: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .profile-header {
          display: flex;
          gap: 20px;
        }
        
        .profile-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          overflow: hidden;
        }
        
        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .profile-avatar.default {
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #1976d2;
          color: white;
          font-size: 36px;
          font-weight: bold;
        }
        
        .profile-info {
          display: flex;
          flex-direction: column;
        }
        
        .profile-name {
          margin: 0 0 8px 0;
          font-size: 24px;
          color: #333;
        }
        
        .profile-email {
          color: #757575;
          margin-bottom: 4px;
        }
        
        .profile-join-date {
          color: #9e9e9e;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}

// Detailed profile
function DetailedProfile({ profile }: { profile: UserProfile }) {
  return (
    <div className="profile-detailed">
      <div className="profile-header">
        {profile.avatar ? (
          <div className="profile-avatar">
            <img src={profile.avatar} alt={profile.name} />
          </div>
        ) : (
          <div className="profile-avatar default">
            {profile.name.charAt(0).toUpperCase()}
          </div>
        )}
        
        <div className="profile-info">
          <h2 className="profile-name">{profile.name}</h2>
          <div className="profile-email">{profile.email}</div>
          <div className="profile-join-date">
            Member since {formatDate(profile.joinDate)}
          </div>
          {profile.location && (
            <div className="profile-location">
              <span className="location-icon">📍</span> {profile.location}
            </div>
          )}
        </div>
      </div>
      
      <div className="profile-sections">
        <section className="profile-section">
          <h3 className="section-title">Activity</h3>
          <div className="profile-stats">
            <StatsCard 
              title="Orders" 
              value={profile.stats.orders} 
              icon="🛒" 
            />
            <StatsCard 
              title="Reviews" 
              value={profile.stats.reviews} 
              icon="⭐" 
            />
            <StatsCard 
              title="Wishlists" 
              value={profile.stats.wishlists} 
              icon="❤️" 
            />
          </div>
        </section>
        
        {profile.bio && (
          <section className="profile-section">
            <h3 className="section-title">About</h3>
            <p className="profile-bio">{profile.bio}</p>
          </section>
        )}
        
        <section className="profile-section">
          <h3 className="section-title">Preferences</h3>
          <div className="profile-preferences">
            <div className="preference-item">
              <span className="preference-label">Theme</span>
              <span className={`preference-value theme-${profile.preferences.theme}`}>
                {profile.preferences.theme.charAt(0).toUpperCase() + profile.preferences.theme.slice(1)}
              </span>
            </div>
            <div className="preference-item">
              <span className="preference-label">Notifications</span>
              <span className={`preference-value ${profile.preferences.notifications ? 'enabled' : 'disabled'}`}>
                {profile.preferences.notifications ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </section>
      </div>
      
      <div className="profile-actions">
        <button className="edit-profile-button">Edit Profile</button>
        <button className="settings-button">Settings</button>
      </div>
      
      <style jsx>{`
        .profile-detailed {
          padding: 24px;
          border-radius: 8px;
          background-color: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .profile-header {
          display: flex;
          gap: 24px;
          margin-bottom: 24px;
        }
        
        .profile-avatar {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          overflow: hidden;
        }
        
        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .profile-avatar.default {
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #1976d2;
          color: white;
          font-size: 42px;
          font-weight: bold;
        }
        
        .profile-info {
          display: flex;
          flex-direction: column;
        }
        
        .profile-name {
          margin: 0 0 8px 0;
          font-size: 28px;
          color: #333;
        }
        
        .profile-email {
          color: #757575;
          margin-bottom: 4px;
        }
        
        .profile-join-date {
          color: #9e9e9e;
          font-size: 14px;
          margin-bottom: 8px;
        }
        
        .profile-location {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #757575;
          font-size: 14px;
        }
        
        .profile-sections {
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin-bottom: 24px;
        }
        
        .profile-section {
          padding: 20px;
          background-color: #f9f9f9;
          border-radius: 8px;
        }
        
        .section-title {
          margin-top: 0;
          margin-bottom: 16px;
          font-size: 18px;
          color: #333;
          border-bottom: 1px solid #e0e0e0;
          padding-bottom: 8px;
        }
        
        .profile-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
        }
        
        .profile-bio {
          margin: 0;
          line-height: 1.6;
          color: #424242;
        }
        
        .profile-preferences {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .preference-item {
          display: flex;
          justify-content: space-between;
          padding: 10px;
          background-color: white;
          border-radius: 4px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        
        .preference-label {
          font-weight: bold;
          color: #333;
        }
        
        .preference-value {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 14px;
        }
        
        .theme-light {
          background-color: #e3f2fd;
          color: #1976d2;
        }
        
        .theme-dark {
          background-color: #263238;
          color: white;
        }
        
        .enabled {
          background-color: #e8f5e9;
          color: #2e7d32;
        }
        
        .disabled {
          background-color: #ffebee;
          color: #c62828;
        }
        
        .profile-actions {
          display: flex;
          gap: 12px;
        }
        
        .edit-profile-button {
          flex: 1;
          padding: 12px;
          background-color: #1976d2;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        
        .edit-profile-button:hover {
          background-color: #1565c0;
        }
        
        .settings-button {
          padding: 12px;
          background-color: white;
          color: #1976d2;
          border: 1px solid #1976d2;
          border-radius: 4px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
        }
        
        .settings-button:hover {
          background-color: #f5f5f5;
        }
        
        @media (max-width: 600px) {
          .profile-header {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          
          .profile-info {
            align-items: center;
          }
          
          .profile-stats {
            grid-template-columns: 1fr;
          }
          
          .profile-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

// Data fetching component
function ProfileData({
  userId,
  detailed = false,
  priority = 'medium'
}: ProfileStreamProps) {
  // Calculate delay based on priority and whether detailed view is requested
  const baseDelay = FETCH_DELAYS[priority];
  const delay = detailed ? baseDelay + DETAILED_DELAY_ADDITION : baseDelay;
  
  // Fetch profile with artificial delay
  const profilePromise = fetchUserProfile(userId, {
    detailed, 
    delay 
  });
  
  // Suspense will catch this promise
  const profile = use(profilePromise);
  
  // Return either simple or detailed profile based on prop
  return detailed ? 
    <DetailedProfile profile={profile} /> : 
    <SimpleProfile profile={profile} />;
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
export default function ProfileStream({
  userId,
  detailed = false,
  priority = 'medium'
}: ProfileStreamProps) {
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
    return <ProfileError error={error} retry={handleRetry} />;
  }
  
  // Streaming profile with appropriate skeleton fallback
  return (
    <Suspense fallback={<ProfileSkeleton detailed={detailed} />}>
      <ProfileData 
        key={key}
        userId={userId}
        detailed={detailed}
        priority={priority}
      />
    </Suspense>
  );
}