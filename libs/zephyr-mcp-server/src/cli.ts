#!/usr/bin/env node
import { Command } from 'commander';
import { createZephyrHostServer } from './host-server';
import * as readline from 'readline';

const program = new Command();

program.name('zephyr-mcp-server').description('Zephyr MCP Host Server').version('1.0.0');

program
  .command('start')
  .description('Start the Zephyr MCP Host Server')
  .option('-k, --api-key <key>', 'Zephyr API key')
  .option(
    '-e, --env <environment>',
    'Environment (production, staging, dev)',
    'production'
  )
  .option('-u, --cloud-url <url>', 'Zephyr Cloud URL or manifest URL')
  .option('-s, --servers <servers>', 'Comma-separated list of allowed servers')
  .option('--no-cache', 'Disable caching')
  .action(async (options) => {
    console.log('Starting Zephyr MCP Host Server...');
    console.log('================================\n');

    // If no cloud URL provided, prompt for MCP server URLs
    const mcpUrls: string[] = [];
    
    if (!options.cloudUrl) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      console.log('Enter Zephyr MCP server URLs (one per line).');
      console.log('Example: https://nestor-lopez-1853-github-tools-mcp-example-zephyr-f1e0463b8-ze.zephyrcloud.app/remoteEntry.js');
      console.log('Press Enter when done.\n');

      const getUrls = (): Promise<void> => {
        return new Promise((resolve) => {
          const askForUrl = () => {
            rl.question('MCP URL (or press Enter to finish): ', (url) => {
              if (url.trim() === '') {
                if (mcpUrls.length > 0) {
                  rl.close();
                  resolve();
                } else {
                  console.log('Please enter at least one URL.');
                  askForUrl();
                }
              } else {
                mcpUrls.push(url.trim());
                console.log(`✓ Added: ${url.trim()}\n`);
                askForUrl();
              }
            });
          };
          askForUrl();
        });
      };

      await getUrls();
      
      console.log(`\nLoading ${mcpUrls.length} MCP server(s)...\n`);
    }

    const config = {
      apiKey: options.apiKey || process.env['ZEPHYR_API_KEY'],
      environment: options.env as 'production' | 'staging' | 'dev',
      cloudUrl: options.cloudUrl,
      mcpUrls: mcpUrls.length > 0 ? mcpUrls : undefined,
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
      const cloudUrl = options.cloudUrl || 'https://cdn.zephyr-cloud.io/mcp/manifest.json';

      console.log(`Fetching MCP servers from: ${cloudUrl}`);

      const response = await fetch(cloudUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.statusText}`);
      }

      const manifest = await response.json();
      const servers = manifest.servers || [];

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
program.action(() => {
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
