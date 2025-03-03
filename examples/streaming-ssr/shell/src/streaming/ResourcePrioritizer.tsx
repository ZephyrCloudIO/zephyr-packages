import React, { useEffect, useState } from 'react';
import { Resource, StreamingPriority } from 'streaming-ssr-shared/dist/types';
import { sortResourcesByPriority } from 'streaming-ssr-shared/dist/streaming';

interface ResourcePrioritizerProps {
  resources: Array<{
    id: string;
    priority: StreamingPriority;
    load: () => Promise<any>;
  }>;
  children: React.ReactNode;
  concurrentLoads?: number;
  showStatus?: boolean;
}

interface ResourceState {
  [key: string]: {
    loading: boolean;
    loaded: boolean;
    error: Error | null;
    startTime?: number;
    endTime?: number;
  };
}

/**
 * A component that manages and prioritizes resource loading
 * 
 * Features:
 * - Priority-based loading queue
 * - Configurable concurrency
 * - Loading progress tracking
 * - Diagnostic UI (optional)
 */
export default function ResourcePrioritizer({
  resources,
  children,
  concurrentLoads = 3,
  showStatus = false,
}: ResourcePrioritizerProps) {
  // Track loading state for each resource
  const [resourceState, setResourceState] = useState<ResourceState>(() => {
    const initialState: ResourceState = {};
    resources.forEach(resource => {
      initialState[resource.id] = {
        loading: false,
        loaded: false,
        error: null
      };
    });
    return initialState;
  });
  
  // Overall loading state
  const [loading, setLoading] = useState(resources.length > 0);
  const [completedCount, setCompletedCount] = useState(0);
  
  // Sort resources by priority
  const sortedResources = sortResourcesByPriority(resources);
  
  // Load resources in priority order
  useEffect(() => {
    // No resources to load
    if (resources.length === 0) {
      setLoading(false);
      return;
    }
    
    // Track currently loading resources
    let activeLoads = 0;
    let queueIndex = 0;
    let completed = 0;
    
    // Function to load a resource
    const loadResource = async (resource: Resource<any>) => {
      // Mark resource as loading
      setResourceState(prev => ({
        ...prev,
        [resource.id]: {
          ...prev[resource.id],
          loading: true,
          startTime: performance.now()
        }
      }));
      
      // Increment active load count
      activeLoads++;
      
      try {
        // Load the resource
        await resource.load();
        
        // Mark resource as loaded
        setResourceState(prev => ({
          ...prev,
          [resource.id]: {
            ...prev[resource.id],
            loading: false,
            loaded: true,
            error: null,
            endTime: performance.now()
          }
        }));
        
        // Update counters
        completed++;
        setCompletedCount(completed);
        activeLoads--;
        
        // If all resources are loaded, set loading to false
        if (completed === resources.length) {
          setLoading(false);
        } else {
          // Otherwise, try to load the next resource
          loadNextResource();
        }
      } catch (error) {
        // Mark resource as failed
        setResourceState(prev => ({
          ...prev,
          [resource.id]: {
            ...prev[resource.id],
            loading: false,
            loaded: false,
            error: error as Error,
            endTime: performance.now()
          }
        }));
        
        // Update counters and try to load the next resource
        completed++;
        setCompletedCount(completed);
        activeLoads--;
        
        if (completed === resources.length) {
          setLoading(false);
        } else {
          loadNextResource();
        }
      }
    };
    
    // Function to load the next resource in the queue
    const loadNextResource = () => {
      // If we've reached the end of the queue, we're done
      if (queueIndex >= sortedResources.length) {
        return;
      }
      
      // If we've reached the concurrency limit, don't load more
      if (activeLoads >= concurrentLoads) {
        return;
      }
      
      // Get the next resource in the queue
      const nextResource = sortedResources[queueIndex];
      
      // Skip resources that are already loading or loaded
      if (
        resourceState[nextResource.id].loading ||
        resourceState[nextResource.id].loaded
      ) {
        queueIndex++;
        loadNextResource();
        return;
      }
      
      // Load the resource
      loadResource(nextResource);
      
      // Move to the next resource in the queue
      queueIndex++;
      
      // Try to load more resources (up to concurrency limit)
      if (activeLoads < concurrentLoads) {
        loadNextResource();
      }
    };
    
    // Start loading resources
    loadNextResource();
    
    // No cleanup needed since we're using local variables
  }, [resources, concurrentLoads, sortedResources, resourceState]);
  
  // Calculate loading progress
  const progress = resources.length > 0
    ? Math.round((completedCount / resources.length) * 100)
    : 100;
  
  return (
    <div className="resource-prioritizer">
      {children}
      
      {showStatus && (
        <div className="resource-status">
          <div className="resource-status-header">
            <h3>Resource Loading Status</h3>
            <div className="resource-progress">
              <div 
                className="resource-progress-bar" 
                style={{ width: `${progress}%` }}
              />
              <div className="resource-progress-text">
                {completedCount} / {resources.length} resources loaded ({progress}%)
              </div>
            </div>
          </div>
          
          <table className="resource-table">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {sortedResources.map(resource => {
                const state = resourceState[resource.id];
                let status = 'Pending';
                if (state.loading) status = 'Loading';
                if (state.loaded) status = 'Loaded';
                if (state.error) status = 'Failed';
                
                // Calculate loading time if applicable
                const loadTime = state.startTime && state.endTime
                  ? ((state.endTime - state.startTime) / 1000).toFixed(2) + 's'
                  : '-';
                
                return (
                  <tr key={resource.id}>
                    <td>{resource.id}</td>
                    <td className={`priority-${resource.priority}`}>
                      {resource.priority}
                    </td>
                    <td className={`status-${status.toLowerCase()}`}>
                      {status}
                    </td>
                    <td>{loadTime}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      <style jsx>{`
        .resource-prioritizer {
          position: relative;
        }
        
        .resource-status {
          margin-top: 20px;
          padding: 16px;
          background-color: #f9f9f9;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
          font-family: monospace;
          font-size: 14px;
        }
        
        .resource-status-header {
          margin-bottom: 16px;
        }
        
        .resource-status-header h3 {
          margin-top: 0;
          margin-bottom: 8px;
          font-size: 16px;
        }
        
        .resource-progress {
          position: relative;
          height: 24px;
          background-color: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .resource-progress-bar {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background-color: #4caf50;
          transition: width 0.3s;
        }
        
        .resource-progress-text {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #333;
          font-weight: bold;
          z-index: 1;
        }
        
        .resource-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .resource-table th {
          text-align: left;
          padding: 8px;
          background-color: #e0e0e0;
        }
        
        .resource-table td {
          padding: 8px;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .priority-critical {
          color: #d32f2f;
          font-weight: bold;
        }
        
        .priority-high {
          color: #f57c00;
          font-weight: bold;
        }
        
        .priority-medium {
          color: #0288d1;
        }
        
        .priority-low {
          color: #388e3c;
        }
        
        .status-loading {
          color: #f57c00;
          font-weight: bold;
        }
        
        .status-loaded {
          color: #388e3c;
        }
        
        .status-failed {
          color: #d32f2f;
        }
        
        .status-pending {
          color: #757575;
        }
      `}</style>
    </div>
  );
}