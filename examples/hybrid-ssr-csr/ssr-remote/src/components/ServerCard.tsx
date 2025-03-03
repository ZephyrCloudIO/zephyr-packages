// This is a Server Component
import React from 'react';

interface ServerCardProps {
  title: string;
  content: string;
  image?: string;
  variant?: 'default' | 'outlined' | 'elevated';
  fullWidth?: boolean;
}

const ServerCard: React.FC<ServerCardProps> = ({
  title,
  content,
  image,
  variant = 'default',
  fullWidth = false,
}) => {
  // Determine styles based on variant
  let cardStyle = '';
  
  switch (variant) {
    case 'outlined':
      cardStyle = `
        border: 1px solid #e0e0e0;
        box-shadow: none;
      `;
      break;
    case 'elevated':
      cardStyle = `
        border: none;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
      `;
      break;
    default:
      cardStyle = `
        border: none;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      `;
  }

  return (
    <div className="server-card">
      {image && (
        <div className="server-card-image-container">
          <img 
            src={image} 
            alt={title} 
            className="server-card-image" 
          />
        </div>
      )}
      <div className="server-card-content">
        <h3 className="server-card-title">{title}</h3>
        <p className="server-card-text">{content}</p>
      </div>
      <style jsx>{`
        .server-card {
          ${cardStyle}
          border-radius: 8px;
          overflow: hidden;
          background-color: #ffffff;
          ${fullWidth ? 'width: 100%;' : 'width: 300px;'}
          margin-bottom: 20px;
        }
        
        .server-card-image-container {
          width: 100%;
          height: 180px;
          overflow: hidden;
        }
        
        .server-card-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .server-card-content {
          padding: 16px;
        }
        
        .server-card-title {
          font-size: 18px;
          font-weight: bold;
          margin: 0 0 8px 0;
          color: #333333;
        }
        
        .server-card-text {
          font-size: 14px;
          color: #666666;
          line-height: 1.5;
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default ServerCard;