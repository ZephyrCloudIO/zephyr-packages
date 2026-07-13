/**
 * Serializes publication attempts while retaining one follow-up request that arrives
 * during an active upload. File watchers can emit several events for a single build;
 * publishing every event would create redundant snapshots, while dropping the last event
 * could leave a development tag behind the local output.
 */
export class SequentialPublisher {
  private active: Promise<void> | undefined;
  private followUpRequested = false;

  constructor(private readonly publish: () => Promise<void>) {}

  request(): Promise<void> {
    if (this.active) {
      this.followUpRequested = true;
      return this.active;
    }

    this.active = this.run();
    return this.active;
  }

  async waitForIdle(): Promise<void> {
    await this.active;
  }

  private async run(): Promise<void> {
    try {
      do {
        this.followUpRequested = false;
        await this.publish();
      } while (this.followUpRequested);
    } finally {
      this.active = undefined;
    }
  }
}
