'use client';

import React from 'react';
import { StreamingPriority } from 'streaming-ssr-shared/dist/types';

interface PrioritySelectorProps {
  onChange: (priority: StreamingPriority) => void;
  value: StreamingPriority;
}

export default function PrioritySelector({ onChange, value }: PrioritySelectorProps) {
  const priorities: StreamingPriority[] = ['critical', 'high', 'medium', 'low'];
  
  return (
    <div className="priority-selector">
      {priorities.map(priority => (
        <button
          key={priority}
          className={`priority-button ${priority === value ? 'active' : ''}`}
          onClick={() => onChange(priority)}
        >
          {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
        </button>
      ))}
    </div>
  );
}