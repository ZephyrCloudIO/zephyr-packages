import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
// Simple weather MCP server
class WeatherMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'weather-tools-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );
    this.server.getClientVersion();

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_weather',
          description: 'Get current weather for a location',
          inputSchema: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'City name or coordinates',
              },
            },
            required: ['location'],
          },
        },
        {
          name: 'get_forecast',
          description: 'Get weather forecast for a location',
          inputSchema: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'City name or coordinates',
              },
              days: {
                type: 'number',
                description: 'Number of days to forecast (1-7)',
                minimum: 1,
                maximum: 7,
              },
            },
            required: ['location'],
          },
        },
        {
          name: 'search_location',
          description: 'Search for location coordinates',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Location search query',
              },
            },
            required: ['query'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'get_weather':
          return this.getWeather(args);
        case 'get_forecast':
          return this.getForecast(args);
        case 'search_location':
          return this.searchLocation(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // List resources (weather data sources)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'weather://api/docs',
          name: 'Weather API Documentation',
          description: 'Information about the weather data sources',
          mimeType: 'text/markdown',
        },
      ],
    }));

    // Read resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (uri === 'weather://api/docs') {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: `# Weather API Documentation

This MCP server provides weather data through a mock API.
In a real implementation, this would connect to services like:
- OpenWeatherMap
- WeatherAPI
- NOAA

## Available Tools

1. **get_weather**: Get current weather conditions
2. **get_forecast**: Get weather forecast for up to 7 days
3. **search_location**: Search for location coordinates

## Example Usage

\`\`\`json
{
  "tool": "get_weather",
  "arguments": {
    "location": "San Francisco"
  }
}
\`\`\`
`,
            },
          ],
        };
      }

      throw new Error(`Resource not found: ${uri}`);
    });
  }

  private async getWeather(args: any) {
    const { location } = args;

    // Mock weather data - in real implementation, call actual API
    const mockData = {
      location,
      temperature: Math.floor(Math.random() * 30) + 10,
      conditions: ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy'][
        Math.floor(Math.random() * 4)
      ],
      humidity: Math.floor(Math.random() * 50) + 30,
      windSpeed: Math.floor(Math.random() * 20) + 5,
    };

    return {
      content: [
        {
          type: 'text',
          text: `Current weather in ${location}:
Temperature: ${mockData.temperature}°C
Conditions: ${mockData.conditions}
Humidity: ${mockData.humidity}%
Wind Speed: ${mockData.windSpeed} km/h`,
        },
      ],
    };
  }

  private async getForecast(args: any) {
    const { location, days = 3 } = args;

    // Mock forecast data
    const forecast = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      forecast.push({
        date: date.toDateString(),
        high: Math.floor(Math.random() * 30) + 10,
        low: Math.floor(Math.random() * 20),
        conditions: ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy'][
          Math.floor(Math.random() * 4)
        ],
      });
    }

    const forecastText = forecast
      .map(
        (day) => `${day.date}: High ${day.high}°C, Low ${day.low}°C, ${day.conditions}`
      )
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Weather forecast for ${location}:\n${forecastText}`,
        },
      ],
    };
  }

  private async searchLocation(args: any) {
    const { query } = args;

    // Mock location search
    const mockLocations = [
      { name: query, lat: Math.random() * 180 - 90, lon: Math.random() * 360 - 180 },
      {
        name: `${query} City`,
        lat: Math.random() * 180 - 90,
        lon: Math.random() * 360 - 180,
      },
      {
        name: `${query} County`,
        lat: Math.random() * 180 - 90,
        lon: Math.random() * 360 - 180,
      },
    ];

    const resultsText = mockLocations
      .map((loc) => `- ${loc.name}: ${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`)
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Location search results for "${query}":\n${resultsText}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Weather MCP server running on stdio');
  }

  // Expose the internal server for Module Federation
  getServer(): Server {
    return this.server;
  }
}

// Export factory function for Module Federation
export default function createWeatherServer() {
  const weatherServer = new WeatherMCPServer();
  return weatherServer.getServer();
}

// Allow direct execution
if (require.main === module) {
  const server = new WeatherMCPServer();
  server.run().catch(console.error);
}
