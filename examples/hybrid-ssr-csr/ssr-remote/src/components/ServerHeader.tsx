// This is a Server Component
import React from 'react';
import { ThemeMode } from 'hybrid-ssr-csr-shared/dist/types';
import { themes } from 'hybrid-ssr-csr-shared/dist/theme';

interface ServerHeaderProps {
  title: string;
  subtitle?: string;
  themeMode?: ThemeMode;
  alignment?: 'left' | 'center' | 'right';
  divider?: boolean;
}

const ServerHeader: React.FC<ServerHeaderProps> = ({
  title,
  subtitle,
  themeMode = 'light',
  alignment = 'left',
  divider = true,
}) => {
  // Get colors from theme
  const themeColors = themes[themeMode];
  
  // Determine text alignment
  const textAlign = alignment;

  return (
    <header className="server-header">
      <h1 className="server-header-title">{title}</h1>
      {subtitle && <p className="server-header-subtitle">{subtitle}</p>}
      {divider && <div className="server-header-divider"></div>}
      
      <style jsx>{`
        .server-header {
          padding: 24px 0;
          text-align: ${textAlign};
          width: 100%;
          margin-bottom: 24px;
        }
        
        .server-header-title {
          font-size: 32px;
          font-weight: bold;
          margin: 0 0 8px 0;
          color: ${themeColors.text};
        }
        
        .server-header-subtitle {
          font-size: 18px;
          color: ${themeColors.text}aa;
          margin: 0 0 16px 0;
        }
        
        .server-header-divider {
          height: 4px;
          width: 60px;
          background-color: ${themeColors.primary};
          margin: ${alignment === 'center' ? '0 auto' : alignment === 'right' ? '0 0 0 auto' : '0'};
          border-radius: 2px;
        }
      `}</style>
    </header>
  );
};

export default ServerHeader;