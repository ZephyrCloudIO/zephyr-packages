import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import styles from '../styles/Home.module.css';

// Import MetadataConsumer
import { 
  MetadataConsumer, 
  RemoteMetadata 
} from '../../../../../remote-entry-structure-sharing-skeleton';

// Define remote components with type safety
const RemoteAComponent = dynamic(() => import('remoteA/Component'), {
  ssr: true,
  loading: () => <div className={styles.placeholder}>Loading Remote A Component...</div>
});

const RemoteBButton = dynamic(() => import('remoteB/Button'), {
  ssr: false, // Explicitly disable SSR for CSR component
  loading: () => <div className={styles.placeholder}>Loading Remote B Button...</div>
});

const RemoteCCard = dynamic(() => import('remoteC/Card'), {
  loading: () => <div className={styles.placeholder}>Loading Remote C Card...</div>
});

// Runtime compatibility check component
interface CompatibilityCheckerProps {
  remoteName: string;
  remoteUrl: string;
}

const CompatibilityChecker = ({ remoteName, remoteUrl }: CompatibilityCheckerProps) => {
  const [status, setStatus] = useState<string>('Checking...');
  const [details, setDetails] = useState<string[]>([]);

  useEffect(() => {
    async function checkCompatibility() {
      try {
        // Fetch remote metadata
        const metadata = await MetadataConsumer.fetchMetadata(remoteUrl);
        
        // Create host metadata
        const hostMetadata: RemoteMetadata = {
          schemaVersion: '1.0.0',
          moduleFederationVersion: '2.0.0',
          renderType: 'ssr',
          framework: 'nextjs',
          dependencies: {
            'react': '^18.2.0',
            'react-dom': '^18.2.0'
          }
        };
        
        // Validate compatibility
        const result = MetadataConsumer.validateCompatibility(hostMetadata, metadata);
        
        if (result.compatible) {
          setStatus('Compatible');
          setDetails(result.warnings);
        } else {
          setStatus('Incompatible');
          setDetails(result.issues);
        }
      } catch (error) {
        setStatus('Error');
        setDetails([error instanceof Error ? error.message : 'Unknown error']);
      }
    }
    
    checkCompatibility();
  }, [remoteUrl]);

  return (
    <div className={styles.compatibilityCheck}>
      <h3>{remoteName}: <span className={
        status === 'Compatible' ? styles.compatible :
        status === 'Incompatible' ? styles.incompatible :
        styles.checking
      }>{status}</span></h3>
      {details.length > 0 && (
        <ul>
          {details.map((detail, i) => (
            <li key={i}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default function Home() {
  const [message, setMessage] = useState<string>('');
  
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>
          Remote Metadata Sharing Example
        </h1>
        
        <div className={styles.compatibilityChecks}>
          <h2>Remote Compatibility</h2>
          <CompatibilityChecker 
            remoteName="Remote A (Next.js SSR)" 
            remoteUrl="http://localhost:3001/remoteEntry.js" 
          />
          <CompatibilityChecker 
            remoteName="Remote B (Vite CSR)" 
            remoteUrl="http://localhost:3002/remoteEntry.js" 
          />
          <CompatibilityChecker 
            remoteName="Remote C (Webpack)" 
            remoteUrl="http://localhost:3003/remoteEntry.js" 
          />
        </div>
        
        <div className={styles.remoteComponents}>
          <h2>Remote Components</h2>
          
          <div className={styles.componentWrapper}>
            <h3>Remote A Component (SSR)</h3>
            <div className={styles.componentContainer}>
              <RemoteAComponent />
            </div>
          </div>
          
          <div className={styles.componentWrapper}>
            <h3>Remote B Component (CSR)</h3>
            <div className={styles.componentContainer}>
              <RemoteBButton 
                text="Click me!"
                onClick={() => setMessage('Button clicked!')}
              />
              {message && <p className={styles.message}>{message}</p>}
            </div>
          </div>
          
          <div className={styles.componentWrapper}>
            <h3>Remote C Component</h3>
            <div className={styles.componentContainer}>
              <RemoteCCard title="Card from Remote C">
                <p>This card component is from Remote C (Webpack)</p>
                <p>It demonstrates cross-framework integration</p>
              </RemoteCCard>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}