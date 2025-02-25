# zephyr agent (Internal)

Read more from our documentation [here](https://docs.zephyr-cloud.io).

This is an internal package to provide zephyr agent for bundler plugins.

## Authentication

The Zephyr agent handles authentication with the Zephyr Cloud service. By default, it will:

1. Check for existing authentication token
2. If no valid token exists, prompt the user with three options:
   - Open browser automatically (Y)
   - Show login URL for manual login (m)
   - Cancel the build (n)
3. Automatically refresh tokens that are about to expire

### Environment Variables

The following environment variable can be used to control authentication behavior:

| Variable          | Description                                    |
| ----------------- | ---------------------------------------------- |
| `ZE_SECRET_TOKEN` | Provide a pre-defined token for authentication |

### Authentication Flow

When authentication is needed, the agent will:

1. Notify the user that authentication is required
2. Present three options: open browser (default), show URL only, or cancel
3. Wait for the user to complete authentication in their browser
4. Automatically detect when authentication is complete
