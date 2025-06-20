import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export async function createGitHubToolsServer(): Promise<Server> {
  const server = new Server({
    name: 'github-tools',
    version: '1.0.0',
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'create_issue',
          description: 'Create a new GitHub issue',
          inputSchema: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'Repository (owner/name)',
              },
              title: {
                type: 'string',
                description: 'Issue title',
              },
              body: {
                type: 'string',
                description: 'Issue body',
              },
              labels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Issue labels',
              },
            },
            required: ['repo', 'title', 'body'],
          },
        },
        {
          name: 'search_issues',
          description: 'Search GitHub issues',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              repo: {
                type: 'string',
                description: 'Limit to repository (owner/name)',
              },
              state: {
                type: 'string',
                enum: ['open', 'closed', 'all'],
                default: 'open',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'create_pr',
          description: 'Create a pull request',
          inputSchema: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'Repository (owner/name)',
              },
              title: {
                type: 'string',
                description: 'PR title',
              },
              body: {
                type: 'string',
                description: 'PR description',
              },
              head: {
                type: 'string',
                description: 'Head branch',
              },
              base: {
                type: 'string',
                description: 'Base branch',
                default: 'main',
              },
            },
            required: ['repo', 'title', 'head'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // In a real implementation, these would call GitHub API
    switch (name) {
      case 'create_issue':
        return {
          content: [
            {
              type: 'text',
              text: `Created issue "${args.title}" in ${args.repo}`,
            },
          ],
        };

      case 'search_issues':
        return {
          content: [
            {
              type: 'text',
              text: `Found 5 issues matching "${args.query}" in ${args.repo || 'all repos'}`,
            },
          ],
        };

      case 'create_pr':
        return {
          content: [
            {
              type: 'text',
              text: `Created PR "${args.title}" from ${args.head} to ${args.base} in ${args.repo}`,
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}

export default createGitHubToolsServer;
