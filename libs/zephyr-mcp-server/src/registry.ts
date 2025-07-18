import type { MCPServerEntry } from './types';

export class MCPRegistry {
  private servers: Map<string, MCPServerEntry> = new Map();

  register(entry: MCPServerEntry): void {
    this.servers.set(entry.name, entry);
  }

  get(name: string): MCPServerEntry | undefined {
    return this.servers.get(name);
  }

  getAll(): MCPServerEntry[] {
    return Array.from(this.servers.values());
  }

  size(): number {
    return this.servers.size;
  }
}
