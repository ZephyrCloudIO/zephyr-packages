// Add a class to manage polling state

export class PollingManager {
  private static instance: PollingManager;
  private activePolls: Set<NodeJS.Timeout> = new Set();
  private isPolling = false;
  private authInProgress = false;

  static getInstance(): PollingManager {
    if (!PollingManager.instance) {
      PollingManager.instance = new PollingManager();
    }
    return PollingManager.instance;
  }

  isAuthInProgress(): boolean {
    return this.authInProgress;
  }

  setAuthInProgress(status: boolean): void {
    this.authInProgress = status;
  }

  startPolling(callback: () => Promise<void>, interval: number): NodeJS.Timeout {
    if (this.isPolling) {
      // Return an existing interval ID instead of null to match return type
      const existingInterval = this.activePolls.values().next().value;
      if (!existingInterval) {
        throw new Error('No active polling interval found');
      }
      return existingInterval;
    }

    this.isPolling = true;
    const intervalId = setInterval(async () => {
      try {
        await callback();
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, interval);

    this.activePolls.add(intervalId);
    return intervalId;
  }

  stopPolling(intervalId: NodeJS.Timeout) {
    if (intervalId) {
      clearInterval(intervalId);
      this.activePolls.delete(intervalId);
    }
    if (this.activePolls.size === 0) {
      this.isPolling = false;
    }
  }

  cleanup() {
    this.activePolls.forEach(clearInterval);
    this.activePolls.clear();
    this.isPolling = false;
    this.authInProgress = false;
  }
}
