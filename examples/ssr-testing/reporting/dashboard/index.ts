/**
 * Performance Dashboard
 * 
 * A utility for creating performance dashboards and visualizing SSR metrics.
 * Generates reports on rendering time, hydration, and bundle sizes.
 */

import { RenderMetrics, HydrationMetrics } from '../../performance/timing';
import { StreamingMetrics } from '../../performance/streaming';
import { BundleSizeMetrics } from '../../performance/bundle-size';
import { ResourceMetrics } from '../../performance/resources';

export interface PerformanceReport {
  /**
   * Name of the report
   */
  name: string;
  
  /**
   * Timestamp when the report was generated
   */
  timestamp: number;
  
  /**
   * Application information
   */
  application: {
    name: string;
    version?: string;
    environment: 'development' | 'production' | 'test';
  };
  
  /**
   * Rendering metrics
   */
  rendering?: RenderMetrics;
  
  /**
   * Hydration metrics
   */
  hydration?: HydrationMetrics;
  
  /**
   * Streaming metrics
   */
  streaming?: StreamingMetrics;
  
  /**
   * Bundle size metrics
   */
  bundleSize?: BundleSizeMetrics;
  
  /**
   * Resource metrics
   */
  resources?: ResourceMetrics;
  
  /**
   * Custom metrics
   */
  custom?: Record<string, any>;
}

export interface DashboardOptions {
  /**
   * Title of the dashboard
   */
  title: string;
  
  /**
   * Description of the dashboard
   */
  description?: string;
  
  /**
   * Format of the dashboard
   */
  format: 'html' | 'json' | 'markdown' | 'console';
  
  /**
   * Whether to include detailed information
   */
  detailed?: boolean;
  
  /**
   * Custom template for the dashboard
   */
  template?: string;
}

/**
 * Creates a performance dashboard from a performance report
 */
export function createDashboard(
  report: PerformanceReport,
  options: DashboardOptions
): string {
  const {
    title,
    description = '',
    format = 'html',
    detailed = false,
    template,
  } = options;
  
  switch (format) {
    case 'html':
      return createHTMLDashboard(report, title, description, detailed, template);
    case 'json':
      return JSON.stringify(report, null, 2);
    case 'markdown':
      return createMarkdownDashboard(report, title, description, detailed);
    case 'console':
      return createConsoleDashboard(report, title, description, detailed);
    default:
      return createHTMLDashboard(report, title, description, detailed, template);
  }
}

/**
 * Creates an HTML dashboard
 */
function createHTMLDashboard(
  report: PerformanceReport,
  title: string,
  description: string,
  detailed: boolean,
  template?: string
): string {
  if (template) {
    // Use custom template
    return template
      .replace(/\{\{title\}\}/g, title)
      .replace(/\{\{description\}\}/g, description)
      .replace(/\{\{report\}\}/g, JSON.stringify(report));
  }
  
  // Basic HTML template
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
    .dashboard { max-width: 1200px; margin: 0 auto; }
    .header { margin-bottom: 20px; }
    .header h1 { margin-bottom: 10px; }
    .header p { color: #666; }
    .section { margin-bottom: 30px; background: #f9f9f9; padding: 20px; border-radius: 5px; }
    .section h2 { margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 10px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
    .metric { background: white; padding: 15px; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .metric h3 { margin-top: 0; color: #555; font-size: 16px; }
    .metric .value { font-size: 24px; font-weight: bold; color: #333; margin: 10px 0; }
    .metric .unit { font-size: 14px; color: #888; }
    .chart { height: 300px; margin-top: 20px; background: white; padding: 15px; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; }
    th { background-color: #f5f5f5; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #888; font-size: 12px; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div class="dashboard">
    <div class="header">
      <h1>${title}</h1>
      <p>${description}</p>
      <p>Generated on ${new Date(report.timestamp).toLocaleString()} for ${report.application.name} (${report.application.environment})</p>
    </div>
    
    ${report.rendering ? renderRenderingSection(report.rendering, detailed) : ''}
    ${report.hydration ? renderHydrationSection(report.hydration, detailed) : ''}
    ${report.streaming ? renderStreamingSection(report.streaming, detailed) : ''}
    ${report.bundleSize ? renderBundleSizeSection(report.bundleSize, detailed) : ''}
    ${report.resources ? renderResourcesSection(report.resources, detailed) : ''}
    
    <div class="footer">
      Generated by SSR Testing Infrastructure
    </div>
  </div>
  
  <script>
    // Initialize charts
    document.addEventListener('DOMContentLoaded', function() {
      ${generateChartJS(report)}
    });
  </script>
</body>
</html>
  `;
}

/**
 * Creates a markdown dashboard
 */
function createMarkdownDashboard(
  report: PerformanceReport,
  title: string,
  description: string,
  detailed: boolean
): string {
  return `# ${title}

${description}

Generated on ${new Date(report.timestamp).toLocaleString()} for ${report.application.name} (${report.application.environment})

${report.rendering ? renderRenderingMarkdown(report.rendering, detailed) : ''}
${report.hydration ? renderHydrationMarkdown(report.hydration, detailed) : ''}
${report.streaming ? renderStreamingMarkdown(report.streaming, detailed) : ''}
${report.bundleSize ? renderBundleSizeMarkdown(report.bundleSize, detailed) : ''}
${report.resources ? renderResourcesMarkdown(report.resources, detailed) : ''}
`;
}

/**
 * Creates a console dashboard
 */
function createConsoleDashboard(
  report: PerformanceReport,
  title: string,
  description: string,
  detailed: boolean
): string {
  const lines: string[] = [];
  
  lines.push(title);
  lines.push('='.repeat(title.length));
  lines.push('');
  
  if (description) {
    lines.push(description);
    lines.push('');
  }
  
  lines.push(`Generated on ${new Date(report.timestamp).toLocaleString()} for ${report.application.name} (${report.application.environment})`);
  lines.push('');
  
  if (report.rendering) {
    lines.push('Rendering Metrics');
    lines.push('-----------------');
    lines.push(`Total Rendering Time: ${report.rendering.totalTime}ms`);
    lines.push(`Initialization: ${report.rendering.phases.initialization}ms`);
    lines.push(`Rendering: ${report.rendering.phases.rendering}ms`);
    lines.push(`Serialization: ${report.rendering.phases.serialization}ms`);
    lines.push(`Output Size: ${formatBytes(report.rendering.outputSize)}`);
    lines.push('');
  }
  
  if (report.hydration) {
    lines.push('Hydration Metrics');
    lines.push('-----------------');
    lines.push(`Total Hydration Time: ${report.hydration.totalTime}ms`);
    lines.push(`Initialization: ${report.hydration.phases.initialization}ms`);
    lines.push(`Hydration: ${report.hydration.phases.hydration}ms`);
    lines.push(`Event Attachment: ${report.hydration.phases.eventAttachment}ms`);
    lines.push('');
  }
  
  if (report.streaming) {
    lines.push('Streaming Metrics');
    lines.push('-----------------');
    lines.push(`Total Streaming Time: ${report.streaming.totalTime}ms`);
    lines.push(`Time to First Byte: ${report.streaming.timeToFirstByte}ms`);
    lines.push(`Time to First Contentful Paint: ${report.streaming.timeToFirstContentfulPaint}ms`);
    lines.push(`Chunk Count: ${report.streaming.chunkCount}`);
    lines.push('');
  }
  
  if (report.bundleSize) {
    lines.push('Bundle Size Metrics');
    lines.push('------------------');
    lines.push(`Total Size: ${formatBytes(report.bundleSize.totalSize)}`);
    lines.push(`Client Total Size: ${formatBytes(report.bundleSize.client.totalSize)}`);
    lines.push(`Server Total Size: ${formatBytes(report.bundleSize.server.totalSize)}`);
    lines.push(`Hydration Size: ${formatBytes(report.bundleSize.client.hydrationSize)}`);
    lines.push('');
    
    if (detailed && report.bundleSize.largestBundles.length > 0) {
      lines.push('Largest Bundles:');
      report.bundleSize.largestBundles.slice(0, 5).forEach((bundle, index) => {
        lines.push(`${index + 1}. ${bundle.name}: ${formatBytes(bundle.size)}`);
      });
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

// Helper functions for HTML sections
function renderRenderingSection(metrics: RenderMetrics, detailed: boolean): string {
  return `
    <div class="section">
      <h2>Server Rendering Metrics</h2>
      <div class="metrics">
        <div class="metric">
          <h3>Total Rendering Time</h3>
          <div class="value">${metrics.totalTime}<span class="unit">ms</span></div>
        </div>
        <div class="metric">
          <h3>Initialization</h3>
          <div class="value">${metrics.phases.initialization}<span class="unit">ms</span></div>
        </div>
        <div class="metric">
          <h3>Rendering</h3>
          <div class="value">${metrics.phases.rendering}<span class="unit">ms</span></div>
        </div>
        <div class="metric">
          <h3>Serialization</h3>
          <div class="value">${metrics.phases.serialization}<span class="unit">ms</span></div>
        </div>
        <div class="metric">
          <h3>Output Size</h3>
          <div class="value">${formatBytes(metrics.outputSize)}</div>
        </div>
      </div>
      
      <div class="chart">
        <canvas id="renderingChart"></canvas>
      </div>
    </div>
  `;
}

function renderHydrationSection(metrics: HydrationMetrics, detailed: boolean): string {
  return `
    <div class="section">
      <h2>Client Hydration Metrics</h2>
      <div class="metrics">
        <div class="metric">
          <h3>Total Hydration Time</h3>
          <div class="value">${metrics.totalTime}<span class="unit">ms</span></div>
        </div>
        <div class="metric">
          <h3>Initialization</h3>
          <div class="value">${metrics.phases.initialization}<span class="unit">ms</span></div>
        </div>
        <div class="metric">
          <h3>Hydration</h3>
          <div class="value">${metrics.phases.hydration}<span class="unit">ms</span></div>
        </div>
        <div class="metric">
          <h3>Event Attachment</h3>
          <div class="value">${metrics.phases.eventAttachment}<span class="unit">ms</span></div>
        </div>
      </div>
      
      <div class="chart">
        <canvas id="hydrationChart"></canvas>
      </div>
    </div>
  `;
}

function renderStreamingSection(metrics: StreamingMetrics, detailed: boolean): string {
  return `
    <div class="section">
      <h2>Streaming Metrics</h2>
      <div class="metrics">
        <div class="metric">
          <h3>Total Streaming Time</h3>
          <div class="value">${metrics.totalTime}<span class="unit">ms</span></div>
        </div>
        <div class="metric">
          <h3>Time to First Byte</h3>
          <div class="value">${metrics.timeToFirstByte}<span class="unit">ms</span></div>
        </div>
        <div class="metric">
          <h3>Time to First Contentful Paint</h3>
          <div class="value">${metrics.timeToFirstContentfulPaint}<span class="unit">ms</span></div>
        </div>
        <div class="metric">
          <h3>Time to Largest Contentful Paint</h3>
          <div class="value">${metrics.timeToLargestContentfulPaint}<span class="unit">ms</span></div>
        </div>
        <div class="metric">
          <h3>Chunk Count</h3>
          <div class="value">${metrics.chunkCount}</div>
        </div>
        <div class="metric">
          <h3>Average Chunk Size</h3>
          <div class="value">${formatBytes(metrics.averageChunkSize)}</div>
        </div>
      </div>
      
      <div class="chart">
        <canvas id="streamingChart"></canvas>
      </div>
      
      ${detailed && metrics.contentDelivery.length > 0 ? `
      <h3>Content Delivery</h3>
      <table>
        <thead>
          <tr>
            <th>Content</th>
            <th>Priority</th>
            <th>Delivery Time</th>
            <th>Chunk</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.contentDelivery.map(content => `
          <tr>
            <td>${content.selector}</td>
            <td>${content.priority}</td>
            <td>${content.deliveryTime}ms</td>
            <td>${content.chunkIndex}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      ` : ''}
    </div>
  `;
}

function renderBundleSizeSection(metrics: BundleSizeMetrics, detailed: boolean): string {
  return `
    <div class="section">
      <h2>Bundle Size Metrics</h2>
      <div class="metrics">
        <div class="metric">
          <h3>Total Size</h3>
          <div class="value">${formatBytes(metrics.totalSize)}</div>
        </div>
        <div class="metric">
          <h3>Total Gzipped Size</h3>
          <div class="value">${formatBytes(metrics.totalGzippedSize)}</div>
        </div>
        <div class="metric">
          <h3>Client Total Size</h3>
          <div class="value">${formatBytes(metrics.client.totalSize)}</div>
        </div>
        <div class="metric">
          <h3>Server Total Size</h3>
          <div class="value">${formatBytes(metrics.server.totalSize)}</div>
        </div>
        <div class="metric">
          <h3>Hydration Size</h3>
          <div class="value">${formatBytes(metrics.client.hydrationSize)}</div>
        </div>
        <div class="metric">
          <h3>Module Count</h3>
          <div class="value">${metrics.moduleCount}</div>
        </div>
      </div>
      
      <div class="chart">
        <canvas id="bundleSizeChart"></canvas>
      </div>
      
      ${detailed && metrics.largestBundles.length > 0 ? `
      <h3>Largest Bundles</h3>
      <table>
        <thead>
          <tr>
            <th>Bundle</th>
            <th>Type</th>
            <th>Size</th>
            <th>Gzipped Size</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.largestBundles.map(bundle => `
          <tr>
            <td>${bundle.name}</td>
            <td>${bundle.type}</td>
            <td>${formatBytes(bundle.size)}</td>
            <td>${formatBytes(bundle.gzippedSize || bundle.size * 0.3)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      ` : ''}
    </div>
  `;
}

function renderResourcesSection(metrics: ResourceMetrics, detailed: boolean): string {
  return `
    <div class="section">
      <h2>Resource Metrics</h2>
      <div class="metrics">
        <div class="metric">
          <h3>Total Resources</h3>
          <div class="value">${metrics.totalResources}</div>
        </div>
        <div class="metric">
          <h3>Total Size</h3>
          <div class="value">${formatBytes(metrics.sizeBreakdown.total)}</div>
        </div>
        <div class="metric">
          <h3>Time to Interactive</h3>
          <div class="value">${metrics.timeToInteractive}<span class="unit">ms</span></div>
        </div>
        <div class="metric">
          <h3>First Contentful Paint</h3>
          <div class="value">${metrics.firstContentfulPaint}<span class="unit">ms</span></div>
        </div>
        <div class="metric">
          <h3>Scripts</h3>
          <div class="value">${metrics.typeBreakdown.script}</div>
        </div>
        <div class="metric">
          <h3>Styles</h3>
          <div class="value">${metrics.typeBreakdown.style}</div>
        </div>
      </div>
      
      <div class="chart">
        <canvas id="resourceSizeChart"></canvas>
      </div>
      
      <div class="chart">
        <canvas id="resourceLoadChart"></canvas>
      </div>
    </div>
  `;
}

// Helper functions for Markdown sections
function renderRenderingMarkdown(metrics: RenderMetrics, detailed: boolean): string {
  return `
## Server Rendering Metrics

- Total Rendering Time: ${metrics.totalTime}ms
- Initialization: ${metrics.phases.initialization}ms
- Rendering: ${metrics.phases.rendering}ms
- Serialization: ${metrics.phases.serialization}ms
- Output Size: ${formatBytes(metrics.outputSize)}
`;
}

function renderHydrationMarkdown(metrics: HydrationMetrics, detailed: boolean): string {
  return `
## Client Hydration Metrics

- Total Hydration Time: ${metrics.totalTime}ms
- Initialization: ${metrics.phases.initialization}ms
- Hydration: ${metrics.phases.hydration}ms
- Event Attachment: ${metrics.phases.eventAttachment}ms
`;
}

function renderStreamingMarkdown(metrics: StreamingMetrics, detailed: boolean): string {
  return `
## Streaming Metrics

- Total Streaming Time: ${metrics.totalTime}ms
- Time to First Byte: ${metrics.timeToFirstByte}ms
- Time to First Contentful Paint: ${metrics.timeToFirstContentfulPaint}ms
- Time to Largest Contentful Paint: ${metrics.timeToLargestContentfulPaint}ms
- Chunk Count: ${metrics.chunkCount}
- Average Chunk Size: ${formatBytes(metrics.averageChunkSize)}

${detailed && metrics.contentDelivery.length > 0 ? `
### Content Delivery

${metrics.contentDelivery.map(content => `- ${content.selector}: Priority ${content.priority}, Delivered at ${content.deliveryTime}ms (Chunk ${content.chunkIndex})`).join('\n')}
` : ''}
`;
}

function renderBundleSizeMarkdown(metrics: BundleSizeMetrics, detailed: boolean): string {
  return `
## Bundle Size Metrics

- Total Size: ${formatBytes(metrics.totalSize)}
- Total Gzipped Size: ${formatBytes(metrics.totalGzippedSize)}
- Client Total Size: ${formatBytes(metrics.client.totalSize)}
- Server Total Size: ${formatBytes(metrics.server.totalSize)}
- Hydration Size: ${formatBytes(metrics.client.hydrationSize)}
- Module Count: ${metrics.moduleCount}

${detailed && metrics.largestBundles.length > 0 ? `
### Largest Bundles

${metrics.largestBundles.map((bundle, index) => `${index + 1}. ${bundle.name} (${bundle.type}): ${formatBytes(bundle.size)}`).join('\n')}
` : ''}
`;
}

function renderResourcesMarkdown(metrics: ResourceMetrics, detailed: boolean): string {
  return `
## Resource Metrics

- Total Resources: ${metrics.totalResources}
- Total Size: ${formatBytes(metrics.sizeBreakdown.total)}
- Time to Interactive: ${metrics.timeToInteractive}ms
- First Contentful Paint: ${metrics.firstContentfulPaint}ms
- Scripts: ${metrics.typeBreakdown.script}
- Styles: ${metrics.typeBreakdown.style}
`;
}

// Helper function to generate Chart.js initialization code
function generateChartJS(report: PerformanceReport): string {
  const charts: string[] = [];
  
  if (report.rendering) {
    charts.push(`
      const renderingCtx = document.getElementById('renderingChart').getContext('2d');
      new Chart(renderingCtx, {
        type: 'bar',
        data: {
          labels: ['Initialization', 'Rendering', 'Serialization', 'Total'],
          datasets: [{
            label: 'Time (ms)',
            data: [
              ${report.rendering.phases.initialization},
              ${report.rendering.phases.rendering},
              ${report.rendering.phases.serialization},
              ${report.rendering.totalTime}
            ],
            backgroundColor: [
              'rgba(54, 162, 235, 0.5)',
              'rgba(75, 192, 192, 0.5)',
              'rgba(255, 206, 86, 0.5)',
              'rgba(153, 102, 255, 0.5)'
            ],
            borderColor: [
              'rgba(54, 162, 235, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(153, 102, 255, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Time (ms)'
              }
            }
          }
        }
      });
    `);
  }
  
  if (report.hydration) {
    charts.push(`
      const hydrationCtx = document.getElementById('hydrationChart').getContext('2d');
      new Chart(hydrationCtx, {
        type: 'bar',
        data: {
          labels: ['Initialization', 'Hydration', 'Event Attachment', 'Total'],
          datasets: [{
            label: 'Time (ms)',
            data: [
              ${report.hydration.phases.initialization},
              ${report.hydration.phases.hydration},
              ${report.hydration.phases.eventAttachment},
              ${report.hydration.totalTime}
            ],
            backgroundColor: [
              'rgba(54, 162, 235, 0.5)',
              'rgba(75, 192, 192, 0.5)',
              'rgba(255, 206, 86, 0.5)',
              'rgba(153, 102, 255, 0.5)'
            ],
            borderColor: [
              'rgba(54, 162, 235, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(153, 102, 255, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Time (ms)'
              }
            }
          }
        }
      });
    `);
  }
  
  if (report.streaming) {
    charts.push(`
      const streamingCtx = document.getElementById('streamingChart').getContext('2d');
      new Chart(streamingCtx, {
        type: 'line',
        data: {
          labels: ['TTFB', 'FCP', 'LCP', 'Total'],
          datasets: [{
            label: 'Time (ms)',
            data: [
              ${report.streaming.timeToFirstByte},
              ${report.streaming.timeToFirstContentfulPaint},
              ${report.streaming.timeToLargestContentfulPaint},
              ${report.streaming.totalTime}
            ],
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 2,
            pointRadius: 5,
            pointBackgroundColor: 'rgba(75, 192, 192, 1)'
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Time (ms)'
              }
            }
          }
        }
      });
    `);
  }
  
  if (report.bundleSize) {
    charts.push(`
      const bundleSizeCtx = document.getElementById('bundleSizeChart').getContext('2d');
      new Chart(bundleSizeCtx, {
        type: 'pie',
        data: {
          labels: ['Client Initial', 'Client Async', 'Client Hydration', 'Server Initial', 'Server Async'],
          datasets: [{
            data: [
              ${report.bundleSize.client.initialSize},
              ${report.bundleSize.client.asyncSize},
              ${report.bundleSize.client.hydrationSize},
              ${report.bundleSize.server.initialSize},
              ${report.bundleSize.server.asyncSize}
            ],
            backgroundColor: [
              'rgba(54, 162, 235, 0.5)',
              'rgba(75, 192, 192, 0.5)',
              'rgba(255, 99, 132, 0.5)',
              'rgba(255, 206, 86, 0.5)',
              'rgba(153, 102, 255, 0.5)'
            ],
            borderColor: [
              'rgba(54, 162, 235, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(255, 99, 132, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(153, 102, 255, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: true,
              text: 'Bundle Size Distribution (bytes)'
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw;
                  return label + ': ' + (value >= 1024 ? Math.round(value / 1024 * 10) / 10 + ' KB' : value + ' B');
                }
              }
            }
          }
        }
      });
    `);
  }
  
  if (report.resources) {
    charts.push(`
      const resourceSizeCtx = document.getElementById('resourceSizeChart').getContext('2d');
      new Chart(resourceSizeCtx, {
        type: 'doughnut',
        data: {
          labels: ['Scripts', 'Styles', 'Images', 'Fonts', 'Other'],
          datasets: [{
            data: [
              ${report.resources.sizeBreakdown.script},
              ${report.resources.sizeBreakdown.style},
              ${report.resources.sizeBreakdown.image},
              ${report.resources.sizeBreakdown.font},
              ${report.resources.sizeBreakdown.other}
            ],
            backgroundColor: [
              'rgba(54, 162, 235, 0.5)',
              'rgba(75, 192, 192, 0.5)',
              'rgba(255, 99, 132, 0.5)',
              'rgba(255, 206, 86, 0.5)',
              'rgba(153, 102, 255, 0.5)'
            ],
            borderColor: [
              'rgba(54, 162, 235, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(255, 99, 132, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(153, 102, 255, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: true,
              text: 'Resource Size Distribution (bytes)'
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw;
                  return label + ': ' + (value >= 1024 ? Math.round(value / 1024 * 10) / 10 + ' KB' : value + ' B');
                }
              }
            }
          }
        }
      });
      
      const resourceLoadCtx = document.getElementById('resourceLoadChart').getContext('2d');
      new Chart(resourceLoadCtx, {
        type: 'bar',
        data: {
          labels: ['Min', 'Average', 'Median', 'P95', 'Max'],
          datasets: [{
            label: 'Load Time (ms)',
            data: [
              ${report.resources.loadTime.min},
              ${report.resources.loadTime.avg},
              ${report.resources.loadTime.median},
              ${report.resources.loadTime.p95},
              ${report.resources.loadTime.max}
            ],
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Time (ms)'
              }
            }
          }
        }
      });
    `);
  }
  
  return charts.join('\n');
}

// Helper function to format bytes
function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const PerformanceDashboard = {
  createDashboard,
};

export default PerformanceDashboard;