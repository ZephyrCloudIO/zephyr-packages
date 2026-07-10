export interface BundleLoadEvent {
  bundleUrl: string;
  remoteName: string;
  status: 'cache-hit' | 'downloaded' | 'skipped';
  hash: string | undefined;
  timestamp: number;
}

export interface UpdateAvailableEvent {
  bundleUrl: string;
  remoteName: string;
  oldHash: string | undefined;
  newHash: string;
  timestamp: number;
}

export interface UpdateDownloadedEvent {
  bundleUrl: string;
  remoteName: string;
  newHash: string;
  timestamp: number;
}

export interface PollCompleteEvent {
  checked: number;
  updated: number;
  timestamp: number;
}

export type CacheEventMap = {
  'bundle:load': BundleLoadEvent;
  'poll:start': undefined;
  'update:available': UpdateAvailableEvent;
  'update:downloaded': UpdateDownloadedEvent;
  'poll:complete': PollCompleteEvent;
};
