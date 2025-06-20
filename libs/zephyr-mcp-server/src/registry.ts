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

  has(name: string): boolean {
    return this.servers.has(name);
  }

  size(): number {
    return this.servers.size;
  }

  clear(): void {
    this.servers.clear();
  }

  remove(name: string): boolean {
    return this.servers.delete(name);
  }

  filter(predicate: (entry: MCPServerEntry) => boolean): MCPServerEntry[] {
    return this.getAll().filter(predicate);
  }
}