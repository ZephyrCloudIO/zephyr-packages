#!/usr/bin/env node
import { Command } from 'commander';
import { createZephyrHostServer } from './host-server';
import * as readline from 'readline';
import { logger } from './logger';

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
  .option(
    '-u, --cloud-url <urls...>',
    'Zephyr Cloud URLs or manifest URLs (space-separated)'
  )
  .option('-s, --servers <servers>', 'Comma-separated list of allowed servers')
  .option('--no-cache', 'Disable caching')
  .action(async (options) => {
    logger.log('Starting Zephyr MCP Host Server...');
    logger.log('================================\n');

    // If no cloud URL provided, prompt for MCP server URLs
    const mcpUrls: string[] = [];
    let cloudUrls: string[] = [];

    // Handle multiple cloud URLs
    if (options.cloudUrl) {
      cloudUrls = Array.isArray(options.cloudUrl) ? options.cloudUrl : [options.cloudUrl];
      logger.log(`Using ${cloudUrls.length} cloud URL(s):`);
      cloudUrls.forEach((url) => logger.log(`  - ${url}`));
    }

    if (!options.cloudUrl) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stderr, // Use stderr to avoid interfering with JSON-RPC
      });

      logger.log('Enter Zephyr MCP server URLs (one per line).');
      logger.log('Example: https://[your-server].zephyrcloud.app/bundle.js');
      logger.log('Note: For mf-manifest.json files, use --cloud-url option instead');
      logger.log('Press Enter when done.\n');

      const getUrls = (): Promise<void> => {
        return new Promise((resolve) => {
          const askForUrl = (): void => {
            rl.question('MCP URL (or press Enter to finish): ', (url) => {
              if (url.trim() === '') {
                if (mcpUrls.length > 0) {
                  rl.close();
                  resolve();
                } else {
                  logger.log('Please enter at least one URL.');
                  askForUrl();
                }
              } else {
                const trimmedUrl = url.trim();
                if (trimmedUrl.endsWith('/mf-manifest.json')) {
                  logger.log('\n⚠️  Detected mf-manifest.json URL.');
                  logger.log(
                    'Please restart with: node ./dist/cli.js start --cloud-url ' +
                      trimmedUrl
                  );
                  logger.log('Or provide direct bundle URLs instead.\n');
                  askForUrl();
                } else {
                  mcpUrls.push(trimmedUrl);
                  logger.log(`✓ Added: ${trimmedUrl}\n`);
                  askForUrl();
                }
              }
            });
          };
          askForUrl();
        });
      };

      await getUrls();

      logger.log(`\nLoading ${mcpUrls.length} MCP server(s)...\n`);
    }

    const config = {
      apiKey: options.apiKey || process.env['ZEPHYR_API_KEY'],
      environment: options.env as 'production' | 'staging' | 'dev',
      cloudUrls: cloudUrls.length > 0 ? cloudUrls : undefined,
      cloudUrl: cloudUrls.length === 1 ? cloudUrls[0] : undefined, // Backward compatibility
      mcpUrls: mcpUrls.length > 0 ? mcpUrls : undefined,
      allowedServers: options.servers ? options.servers.split(',') : undefined,
      cache: {
        enabled: options.cache !== false,
        ttl: 3600000,
      },
    };

    try {
      const host = await createZephyrHostServer(config);

      logger.log('✓ Host server initialized');
      logger.log('✓ Connecting to stdio...');

      await host.connect(process.stdin, process.stdout);

      logger.log('Zephyr MCP Host Server is running');
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  });

// Default command
program.action(() => {
  program.outputHelp();
});

// Handle errors
process.on('SIGINT', () => {
  logger.log('\nShutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.log('\nShutting down...');
  process.exit(0);
});

program.parse();
