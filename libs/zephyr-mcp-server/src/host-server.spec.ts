import { ZephyrHostMCPServer } from './host-server';

describe('ZephyrHostMCPServer', () => {
  it('should create an instance', () => {
    const server = new ZephyrHostMCPServer();
    expect(server).toBeDefined();
    expect(server.getServer()).toBeDefined();
  });

  it('should create with custom config', () => {
    const config = {
      environment: 'dev' as const,
      cloudUrl: 'https://custom.example.com',
    };
    const server = new ZephyrHostMCPServer(config);
    expect(server).toBeDefined();
  });
});