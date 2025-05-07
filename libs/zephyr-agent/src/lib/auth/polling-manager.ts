// Add a class to manage polling state
import { ze_log } from '../logging';
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
    const poll = async () => {
      try {
        await callback();
      } catch (error) {
        console.error('Polling error:', error);
      }
      // Schedule next poll
      const timer = setTimeout(poll, interval);
      timer.unref(); // Allow process to exit even if this timer is still pending
    };

    // Start polling
    const initialTimer = setTimeout(poll, interval);
    initialTimer.unref();

    this.activePolls.add(initialTimer);
    return initialTimer;
  }

  stopPolling(intervalId: NodeJS.Timeout) {
    ze_log('stopPolling: Stopping polling...');
    if (intervalId) {
      ze_log('InternalID', intervalId);
      clearInterval(intervalId);
      this.activePolls.delete(intervalId);
      this.cleanup();
    }
    if (this.activePolls.size === 0) {
      this.cleanup();
    }
  }

  cleanup() {
    Promise.race([
      this.activePolls.forEach(clearInterval),
      this.activePolls.clear(),
      this.isPolling = false,
      this.authInProgress = false,])
  }
}
