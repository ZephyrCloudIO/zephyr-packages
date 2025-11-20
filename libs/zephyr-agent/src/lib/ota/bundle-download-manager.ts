import type { BundleMetadata } from 'zephyr-edge-contract';
import { ZephyrError, ZeErrors } from '../errors';
import { fetchWithRetries } from '../http/fetch-with-retries';
import type { BundleStorageLayer } from './bundle-storage-layer';
import { BundleIntegrityVerifier } from './bundle-integrity';

/** Download priority levels */
export enum DownloadPriority {
  /** Critical bundles needed immediately (e.g., main entry) */
  CRITICAL = 0,
  /** High priority bundles (e.g., commonly used remotes) */
  HIGH = 1,
  /** Normal priority bundles */
  NORMAL = 2,
  /** Low priority bundles (e.g., lazy-loaded routes) */
  LOW = 3,
}

/** Download task state */
export enum DownloadState {
  /** Task is queued but not started */
  QUEUED = 'queued',
  /** Task is currently downloading */
  DOWNLOADING = 'downloading',
  /** Task completed successfully */
  COMPLETED = 'completed',
  /** Task failed after retries */
  FAILED = 'failed',
  /** Task was cancelled */
  CANCELLED = 'cancelled',
}

/** Network type for download strategy */
export enum NetworkType {
  /** WiFi connection - allow all downloads */
  WIFI = 'wifi',
  /** Cellular connection - limit concurrent downloads */
  CELLULAR = 'cellular',
  /** No connection */
  NONE = 'none',
  /** Unknown connection type */
  UNKNOWN = 'unknown',
}

/** Download task representation */
export interface DownloadTask {
  /** Unique task ID (bundle checksum) */
  id: string;
  /** Bundle metadata */
  bundle: BundleMetadata;
  /** Download priority */
  priority: DownloadPriority;
  /** Application UID */
  applicationUid: string;
  /** Version */
  version: string;
  /** Current state */
  state: DownloadState;
  /** Download progress (0-100) */
  progress: number;
  /** Number of retry attempts */
  retries: number;
  /** Error if failed */
  error?: Error;
  /** Timestamp when queued */
  queuedAt: number;
  /** Timestamp when started */
  startedAt?: number;
  /** Timestamp when completed/failed */
  completedAt?: number;
}

/** Download manager configuration */
export interface BundleDownloadConfig {
  /** Maximum concurrent downloads */
  maxConcurrent?: number;
  /** Maximum retry attempts per bundle */
  maxRetries?: number;
  /** Initial retry delay in ms */
  retryDelayMs?: number;
  /** Maximum retry delay in ms */
  maxRetryDelayMs?: number;
  /** Download timeout in ms */
  timeoutMs?: number;
  /** Only download on WiFi */
  wifiOnly?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

/** Download progress callback */
export interface DownloadProgressCallback {
  (task: DownloadTask): void;
}

/** Download callbacks */
export interface DownloadCallbacks {
  /** Called when a download starts */
  onDownloadStart?: DownloadProgressCallback;
  /** Called when download progress updates */
  onDownloadProgress?: DownloadProgressCallback;
  /** Called when a download completes successfully */
  onDownloadComplete?: DownloadProgressCallback;
  /** Called when a download fails after retries */
  onDownloadFailed?: DownloadProgressCallback;
  /** Called when all downloads complete */
  onAllComplete?: () => void;
}

/**
 * BundleDownloadManager handles downloading JavaScript bundles with priority queue, retry
 * logic, and progress tracking
 *
 * Features:
 *
 * - Priority queue (critical → high → normal → low)
 * - Exponential backoff retry logic
 * - Progress tracking with callbacks
 * - Network type detection (WiFi vs cellular)
 * - Concurrent download management
 * - Automatic integrity verification
 * - Atomic storage via BundleStorageLayer
 *
 * Usage:
 *
 * ```ts
 * const downloadManager = new BundleDownloadManager(
 *   storageLayer,
 *   {
 *     maxConcurrent: 3,
 *     wifiOnly: false,
 *     debug: true,
 *   },
 *   {
 *     onDownloadProgress: (task) => console.log(`${task.id}: ${task.progress}%`),
 *     onAllComplete: () => console.log('All downloads complete!'),
 *   }
 * );
 *
 * await downloadManager.queueBundle(
 *   bundle,
 *   'app-123',
 *   '1.0.0',
 *   DownloadPriority.HIGH
 * );
 * await downloadManager.start();
 * ```
 */
export class BundleDownloadManager {
  private config: Required<BundleDownloadConfig>;
  private callbacks: DownloadCallbacks;
  private storageLayer: BundleStorageLayer;
  private integrityVerifier: BundleIntegrityVerifier;

  private taskQueue: DownloadTask[] = [];
  private activeTasks: Map<string, DownloadTask> = new Map();
  private completedTasks: Map<string, DownloadTask> = new Map();

  private isRunning = false;
  private networkType: NetworkType = NetworkType.UNKNOWN;

  constructor(
    storageLayer: BundleStorageLayer,
    config: BundleDownloadConfig = {},
    callbacks: DownloadCallbacks = {}
  ) {
    this.storageLayer = storageLayer;
    this.callbacks = callbacks;

    this.config = {
      maxConcurrent: 3,
      maxRetries: 3,
      retryDelayMs: 1000,
      maxRetryDelayMs: 30000,
      timeoutMs: 60000,
      wifiOnly: false,
      debug: false,
      ...config,
    };

    this.integrityVerifier = new BundleIntegrityVerifier(this.config.debug);

    // Detect initial network type (non-blocking)
    void this.detectNetworkType();
  }

  /**
   * Queue a bundle for download
   *
   * @param bundle Bundle metadata
   * @param applicationUid Application UID
   * @param version Version string
   * @param priority Download priority
   * @returns Task ID (bundle checksum)
   */
  async queueBundle(
    bundle: BundleMetadata,
    applicationUid: string,
    version: string,
    priority: DownloadPriority = DownloadPriority.NORMAL
  ): Promise<string> {
    const taskId = bundle.checksum;

    // Check if already completed
    if (this.completedTasks.has(taskId)) {
      this.log(`Bundle ${taskId} already downloaded`);
      return taskId;
    }

    // Check if already in cache
    const cached = await this.storageLayer.hasBundle(bundle.checksum);
    if (cached) {
      this.log(`Bundle ${taskId} found in cache, skipping download`);
      const task: DownloadTask = {
        id: taskId,
        bundle,
        priority,
        applicationUid,
        version,
        state: DownloadState.COMPLETED,
        progress: 100,
        retries: 0,
        queuedAt: Date.now(),
        completedAt: Date.now(),
      };
      this.completedTasks.set(taskId, task);
      return taskId;
    }

    // Check if already queued or downloading
    if (this.activeTasks.has(taskId) || this.taskQueue.some((t) => t.id === taskId)) {
      this.log(`Bundle ${taskId} already queued or downloading`);
      return taskId;
    }

    // Create task
    const task: DownloadTask = {
      id: taskId,
      bundle,
      priority,
      applicationUid,
      version,
      state: DownloadState.QUEUED,
      progress: 0,
      retries: 0,
      queuedAt: Date.now(),
    };

    // Add to queue (will be sorted by priority)
    this.taskQueue.push(task);
    this.sortQueue();

    this.log(`Queued bundle ${taskId} with priority ${priority}`);

    // Start processing if not already running (non-blocking)
    if (this.isRunning) {
      void this.processQueue();
    }

    return taskId;
  }

  /**
   * Queue multiple bundles for download
   *
   * @param bundles Array of bundles with metadata
   * @returns Array of task IDs
   */
  async queueBundles(
    bundles: Array<{
      bundle: BundleMetadata;
      applicationUid: string;
      version: string;
      priority?: DownloadPriority;
    }>
  ): Promise<string[]> {
    const taskIds: string[] = [];

    for (const { bundle, applicationUid, version, priority } of bundles) {
      const taskId = await this.queueBundle(bundle, applicationUid, version, priority);
      taskIds.push(taskId);
    }

    return taskIds;
  }

  /** Start processing download queue */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.log('Download manager already running');
      return;
    }

    this.isRunning = true;
    this.log('Starting download manager', {
      queueSize: this.taskQueue.length,
      maxConcurrent: this.config.maxConcurrent,
    });

    await this.processQueue();
  }

  /** Stop processing download queue */
  stop(): void {
    this.isRunning = false;
    this.log('Stopping download manager');
  }

  /**
   * Cancel a specific download task
   *
   * @param taskId Task ID (bundle checksum)
   */
  cancelTask(taskId: string): void {
    // Remove from queue
    const queueIndex = this.taskQueue.findIndex((t) => t.id === taskId);
    if (queueIndex !== -1) {
      const task = this.taskQueue[queueIndex];
      task.state = DownloadState.CANCELLED;
      this.taskQueue.splice(queueIndex, 1);
      this.log(`Cancelled queued task ${taskId}`);
    }

    // Cancel active task
    const activeTask = this.activeTasks.get(taskId);
    if (activeTask) {
      activeTask.state = DownloadState.CANCELLED;
      this.activeTasks.delete(taskId);
      this.log(`Cancelled active task ${taskId}`);
    }
  }

  /** Cancel all download tasks */
  cancelAll(): void {
    this.log('Cancelling all downloads');

    // Cancel queued tasks
    for (const task of this.taskQueue) {
      task.state = DownloadState.CANCELLED;
    }
    this.taskQueue = [];

    // Cancel active tasks
    for (const [taskId, task] of this.activeTasks) {
      task.state = DownloadState.CANCELLED;
      this.activeTasks.delete(taskId);
    }

    this.stop();
  }

  /** Get download statistics */
  getStats(): {
    queued: number;
    active: number;
    completed: number;
    failed: number;
    total: number;
  } {
    const queued = this.taskQueue.length;
    const active = this.activeTasks.size;
    const completed = Array.from(this.completedTasks.values()).filter(
      (t) => t.state === DownloadState.COMPLETED
    ).length;
    const failed = Array.from(this.completedTasks.values()).filter(
      (t) => t.state === DownloadState.FAILED
    ).length;

    return {
      queued,
      active,
      completed,
      failed,
      total: queued + active + completed + failed,
    };
  }

  /**
   * Get task status
   *
   * @param taskId Task ID (bundle checksum)
   */
  getTaskStatus(taskId: string): DownloadTask | undefined {
    return (
      this.activeTasks.get(taskId) ||
      this.completedTasks.get(taskId) ||
      this.taskQueue.find((t) => t.id === taskId)
    );
  }

  /** Process the download queue */
  private async processQueue(): Promise<void> {
    while (this.isRunning && (this.taskQueue.length > 0 || this.activeTasks.size > 0)) {
      // Check network conditions
      await this.detectNetworkType();

      if (this.config.wifiOnly && this.networkType !== NetworkType.WIFI) {
        this.log('Waiting for WiFi connection');
        await this.sleep(5000);
        continue;
      }

      if (this.networkType === NetworkType.NONE) {
        this.log('No network connection, waiting');
        await this.sleep(5000);
        continue;
      }

      // Calculate max concurrent based on network type
      const maxConcurrent =
        this.networkType === NetworkType.CELLULAR
          ? Math.min(2, this.config.maxConcurrent)
          : this.config.maxConcurrent;

      // Start new downloads if we have capacity
      while (
        this.activeTasks.size < maxConcurrent &&
        this.taskQueue.length > 0 &&
        this.isRunning
      ) {
        const task = this.taskQueue.shift()!;
        this.activeTasks.set(task.id, task);
        // Start download without awaiting (concurrent downloads)
        void this.downloadTask(task);
      }

      // Wait a bit before checking again
      await this.sleep(100);
    }

    // All tasks complete
    if (this.isRunning && this.taskQueue.length === 0 && this.activeTasks.size === 0) {
      this.log('All downloads complete');
      this.callbacks.onAllComplete?.();
    }
  }

  /** Download a single task with retry logic */
  private async downloadTask(task: DownloadTask): Promise<void> {
    task.state = DownloadState.DOWNLOADING;
    task.startedAt = Date.now();
    task.progress = 0;

    this.log(`Starting download ${task.id}`);
    this.callbacks.onDownloadStart?.(task);

    let lastError: Error | undefined;

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        task.retries = attempt;

        // Download bundle content
        const response = await fetchWithRetries(
          new URL(task.bundle.url),
          {
            method: 'GET',
            headers: {
              Accept: 'application/javascript',
            },
          },
          1 // fetchWithRetries already has retry logic, use 1 here
        );

        const content = await response.text();

        // Update progress
        task.progress = 50;
        this.callbacks.onDownloadProgress?.(task);

        // Verify integrity
        const integrityResult = await this.integrityVerifier.verify(task.bundle, content);

        if (!integrityResult.valid) {
          throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
            message: `Integrity check failed: ${integrityResult.error}`,
          });
        }

        task.progress = 75;
        this.callbacks.onDownloadProgress?.(task);

        // Store bundle
        await this.storageLayer.storeBundle(
          task.bundle,
          content,
          task.applicationUid,
          task.version
        );

        // Success!
        task.state = DownloadState.COMPLETED;
        task.progress = 100;
        task.completedAt = Date.now();

        this.activeTasks.delete(task.id);
        this.completedTasks.set(task.id, task);

        this.log(`Download completed ${task.id}`);
        this.callbacks.onDownloadComplete?.(task);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log(
          `Download attempt ${attempt + 1} failed for ${task.id}:`,
          lastError.message
        );

        // If not last attempt, wait with exponential backoff
        if (attempt < this.config.maxRetries) {
          const delay = Math.min(
            this.config.retryDelayMs * Math.pow(2, attempt),
            this.config.maxRetryDelayMs
          );
          this.log(`Retrying ${task.id} in ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    task.state = DownloadState.FAILED;
    task.error = lastError;
    task.completedAt = Date.now();

    this.activeTasks.delete(task.id);
    this.completedTasks.set(task.id, task);

    this.log(`Download failed ${task.id}:`, lastError?.message);
    this.callbacks.onDownloadFailed?.(task);
  }

  /** Sort queue by priority (critical first) */
  private sortQueue(): void {
    this.taskQueue.sort((a, b) => {
      // First sort by priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then by queue time (FIFO for same priority)
      return a.queuedAt - b.queuedAt;
    });
  }

  /** Detect network type (WiFi, cellular, none) */
  private async detectNetworkType(): Promise<void> {
    try {
      // Try to use React Native NetInfo
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const NetInfo = require('@react-native-community/netinfo');
      const state = await NetInfo.fetch();

      if (!state.isConnected) {
        this.networkType = NetworkType.NONE;
      } else if (state.type === 'wifi') {
        this.networkType = NetworkType.WIFI;
      } else if (state.type === 'cellular') {
        this.networkType = NetworkType.CELLULAR;
      } else {
        this.networkType = NetworkType.UNKNOWN;
      }

      this.log('Network type detected:', this.networkType);
    } catch {
      // NetInfo not available, assume WiFi
      this.networkType = NetworkType.WIFI;
    }
  }

  /** Sleep utility */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Debug logging */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[BundleDownload] ${message}`, data || '');
    }
  }
}
