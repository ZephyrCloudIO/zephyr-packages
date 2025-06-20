#!/usr/bin/env node
import { Command } from 'commander';
import { createZephyrHostServer } from './host-server';

const program = new Command();

program
  .name('zephyr-mcp-server')
  .description('Zephyr MCP Host Server')
  .version('1.0.0');

program
  .command('start')
  .description('Start the Zephyr MCP Host Server')
  .option('-k, --api-key <key>', 'Zephyr API key')
  .option('-e, --env <environment>', 'Environment (production, staging, dev)', 'production')
  .option('-s, --servers <servers>', 'Comma-separated list of allowed servers')
  .option('--no-cache', 'Disable caching')
  .action(async (options) => {
    console.log('Starting Zephyr MCP Host Server...');
    console.log('================================');

    const config = {
      apiKey: options.apiKey || process.env['ZEPHYR_API_KEY'],
      environment: options.env as 'production' | 'staging' | 'dev',
      allowedServers: options.servers ? options.servers.split(',') : undefined,
      cache: {
        enabled: options.cache !== false,
        ttl: 3600000,
      },
    };

    try {
      const host = await createZephyrHostServer(config);

      console.log('✓ Host server initialized');
      console.log('✓ Connecting to stdio...');

      await host.connect(process.stdin, process.stdout);

      console.error('Zephyr MCP Host Server is running');

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List available MCP servers from Zephyr Cloud')
  .option('-k, --api-key <key>', 'Zephyr API key')
  .option('-e, --env <environment>', 'Environment', 'production')
  .action(async (options) => {
    try {
      const { ZephyrEngine } = await import('zephyr-agent');

      const engine = await ZephyrEngine.create({
        builder: 'mcp-cli',
        context: process.cwd(),
        apiKey: options.apiKey || process.env['ZEPHYR_API_KEY'],
        environment: options.env,
      });

      const response = await engine.api.get('/mcp/servers', {
        params: { status: 'active' },
      });

      const servers = response.data.servers || [];

      console.log('\nAvailable MCP Servers:');
      console.log('=====================');

      for (const server of servers) {
        console.log(`\n${server.name} v${server.version}`);
        console.log(`  Description: ${server.description}`);
        console.log(`  Status: ${server.status}`);
        if (server.metadata?.capabilities) {
          const caps = server.metadata.capabilities;
          if (caps.tools?.length) {
            console.log(`  Tools: ${caps.tools.join(', ')}`);
          }
        }
      }

    } catch (error) {
      console.error('Failed to list servers:', error);
      process.exit(1);
    }
  });

// Default command
program
  .action(() => {
    program.outputHelp();
  });

// Handle errors
process.on('SIGINT', () => {
  console.error('\nShutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\nShutting down...');
  process.exit(0);
});

program.parse();
