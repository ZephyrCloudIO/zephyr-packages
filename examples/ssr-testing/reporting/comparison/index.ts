/**
 * Comparison Reporter
 * 
 * A utility for comparing different SSR approaches and configurations.
 * Enables side-by-side comparison of rendering strategies, frameworks, and optimizations.
 */

import { PerformanceReport } from '../dashboard';

export interface ComparisonConfig {
  /**
   * Reports to compare
   */
  reports: PerformanceReport[];
  
  /**
   * Metrics to include in the comparison
   */
  metrics: Array<{
    name: string;
    label: string;
    selector: (report: PerformanceReport) => number;
    unit?: string;
    higherIsBetter?: boolean;
  }>;
  
  /**
   * Report names for display
   */
  names?: string[];
  
  /**
   * Description of the comparison
   */
  description?: string;
}

export interface ComparisonResult {
  /**
   * Names of compared reports
   */
  names: string[];
  
  /**
   * Raw metric values
   */
  metrics: Array<{
    name: string;
    label: string;
    values: number[];
    unit?: string;
    higherIsBetter: boolean;
    best: number;
    worst: number;
    average: number;
    percentageDiff: number[];
  }>;
  
  /**
   * Overall winners for each metric
   */
  winners: Record<string, string>;
  
  /**
   * Overall score for each report
   */
  scores: number[];
  
  /**
   * Best overall approach
   */
  bestOverall?: string;
  
  /**
   * Summary of the comparison
   */
  summary: string;
}

/**
 * Compares different performance reports
 */
export function compareReports(config: ComparisonConfig): ComparisonResult {
  const { reports, metrics, names = [], description = '' } = config;
  
  // Use provided names or fallback to report names
  const reportNames = names.length === reports.length
    ? names
    : reports.map(r => r.name);
  
  // Process each metric
  const processedMetrics = metrics.map(metric => {
    const { name, label, selector, unit = '', higherIsBetter = false } = metric;
    
    // Extract values for each report
    const values = reports.map(report => selector(report));
    
    // Find best and worst values
    const best = higherIsBetter ? Math.max(...values) : Math.min(...values);
    const worst = higherIsBetter ? Math.min(...values) : Math.max(...values);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Calculate percentage differences from the best
    const percentageDiff = values.map(value => {
      if (best === 0) return 0;
      const diff = ((value - best) / best) * 100;
      return higherIsBetter ? -diff : diff; // Negative for higher-is-better when value < best
    });
    
    return {
      name,
      label,
      values,
      unit,
      higherIsBetter,
      best,
      worst,
      average,
      percentageDiff,
    };
  });
  
  // Determine winners for each metric
  const winners: Record<string, string> = {};
  
  processedMetrics.forEach(metric => {
    const bestIndex = metric.values.findIndex(
      value => value === (metric.higherIsBetter ? Math.max(...metric.values) : Math.min(...metric.values))
    );
    
    winners[metric.name] = reportNames[bestIndex];
  });
  
  // Calculate overall scores (lower is better)
  // Normalized percentage difference from best, summed across metrics
  const scores = reports.map((_, reportIndex) => {
    return processedMetrics.reduce((score, metric) => {
      // Get absolute percentage difference from best (always positive)
      const percentDiff = Math.abs(metric.percentageDiff[reportIndex]);
      
      // Add to score (weighted equally for now)
      return score + percentDiff;
    }, 0);
  });
  
  // Find best overall approach
  const bestScore = Math.min(...scores);
  const bestOverallIndex = scores.findIndex(score => score === bestScore);
  const bestOverall = reportNames[bestOverallIndex];
  
  // Generate a summary
  let summary = 'Comparison Summary:\n\n';
  
  // Add information about each metric
  processedMetrics.forEach(metric => {
    const winnerIndex = metric.values.findIndex(
      value => value === (metric.higherIsBetter ? Math.max(...metric.values) : Math.min(...metric.values))
    );
    
    const winnerName = reportNames[winnerIndex];
    const winnerValue = metric.values[winnerIndex];
    
    summary += `${metric.label}: Winner is ${winnerName} with ${winnerValue}${metric.unit}`;
    
    // Add comparison to others
    const otherReports = reportNames.filter((_, i) => i !== winnerIndex);
    const otherValues = metric.values.filter((_, i) => i !== winnerIndex);
    const otherDiffs = metric.percentageDiff.filter((_, i) => i !== winnerIndex);
    
    otherReports.forEach((name, i) => {
      summary += `\n  ${name}: ${otherValues[i]}${metric.unit} (${otherDiffs[i] > 0 ? '+' : ''}${otherDiffs[i].toFixed(1)}%)`;
    });
    
    summary += '\n\n';
  });
  
  // Add overall winner
  summary += `Overall Winner: ${bestOverall}\n`;
  
  // Add any additional insights
  const significantMetrics = processedMetrics.filter(metric => {
    // Find metrics with significant differences (>20%)
    const maxDiff = Math.max(...metric.percentageDiff.map(Math.abs));
    return maxDiff > 20;
  });
  
  if (significantMetrics.length > 0) {
    summary += '\nSignificant differences found in:\n';
    significantMetrics.forEach(metric => {
      summary += `- ${metric.label} (up to ${Math.max(...metric.percentageDiff.map(Math.abs)).toFixed(1)}% difference)\n`;
    });
  }
  
  return {
    names: reportNames,
    metrics: processedMetrics,
    winners,
    scores,
    bestOverall,
    summary,
  };
}

/**
 * Generates a comparison report in various formats
 */
export function generateComparisonReport(
  result: ComparisonResult,
  format: 'html' | 'markdown' | 'console' = 'html',
  title: string = 'SSR Comparison Report'
): string {
  switch (format) {
    case 'html':
      return generateHtmlReport(result, title);
    case 'markdown':
      return generateMarkdownReport(result, title);
    case 'console':
      return generateConsoleReport(result, title);
    default:
      return generateHtmlReport(result, title);
  }
}

/**
 * Generates an HTML comparison report
 */
function generateHtmlReport(
  result: ComparisonResult,
  title: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
    .report { max-width: 1200px; margin: 0 auto; }
    .header { margin-bottom: 20px; }
    .header h1 { margin-bottom: 10px; }
    .section { margin-bottom: 30px; background: #f9f9f9; padding: 20px; border-radius: 5px; }
    .section h2 { margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; }
    th { background-color: #f5f5f5; }
    .winner { font-weight: bold; color: #4caf50; }
    .worst { color: #f44336; }
    .chart { height: 400px; margin-top: 20px; background: white; padding: 15px; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .summary { white-space: pre-line; line-height: 1.5; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #888; font-size: 12px; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div class="report">
    <div class="header">
      <h1>${title}</h1>
    </div>
    
    <div class="section">
      <h2>Comparison Summary</h2>
      <p>Best overall approach: <strong>${result.bestOverall}</strong></p>
      <div class="summary">${result.summary}</div>
    </div>
    
    <div class="section">
      <h2>Metrics Comparison</h2>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            ${result.names.map(name => `<th>${name}</th>`).join('')}
            <th>Best</th>
          </tr>
        </thead>
        <tbody>
          ${result.metrics.map(metric => `
          <tr>
            <td>${metric.label}</td>
            ${metric.values.map((value, i) => {
              const isWinner = value === (metric.higherIsBetter ? Math.max(...metric.values) : Math.min(...metric.values));
              const isWorst = value === (metric.higherIsBetter ? Math.min(...metric.values) : Math.max(...metric.values));
              return `<td class="${isWinner ? 'winner' : isWorst ? 'worst' : ''}">${value}${metric.unit} ${metric.percentageDiff[i] !== 0 ? `(${metric.percentageDiff[i] > 0 ? '+' : ''}${metric.percentageDiff[i].toFixed(1)}%)` : ''}</td>`;
            }).join('')}
            <td>${result.winners[metric.name]}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="chart">
        <canvas id="metricsChart"></canvas>
      </div>
      
      <div class="chart">
        <canvas id="scoresChart"></canvas>
      </div>
    </div>
    
    <div class="footer">
      Generated by SSR Testing Infrastructure
    </div>
  </div>
  
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Metrics comparison chart
      const metricsCtx = document.getElementById('metricsChart').getContext('2d');
      new Chart(metricsCtx, {
        type: 'bar',
        data: {
          labels: ${JSON.stringify(result.metrics.map(m => m.label))},
          datasets: ${JSON.stringify(result.names.map((name, i) => ({
            label: name,
            data: result.metrics.map(metric => metric.values[i]),
            backgroundColor: getColor(i, 0.5),
            borderColor: getColor(i, 1),
            borderWidth: 1
          })))}
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
      
      // Overall scores chart
      const scoresCtx = document.getElementById('scoresChart').getContext('2d');
      new Chart(scoresCtx, {
        type: 'bar',
        data: {
          labels: ${JSON.stringify(result.names)},
          datasets: [{
            label: 'Overall Score (lower is better)',
            data: ${JSON.stringify(result.scores)},
            backgroundColor: ${JSON.stringify(result.names.map((_, i) => getColor(i, 0.5)))},
            borderColor: ${JSON.stringify(result.names.map((_, i) => getColor(i, 1)))},
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
      
      function getColor(index, alpha) {
        const colors = [
          \`rgba(54, 162, 235, \${alpha})\`,
          \`rgba(75, 192, 192, \${alpha})\`,
          \`rgba(255, 99, 132, \${alpha})\`,
          \`rgba(255, 206, 86, \${alpha})\`,
          \`rgba(153, 102, 255, \${alpha})\`
        ];
        return colors[index % colors.length];
      }
    });
  </script>
</body>
</html>
  `;
}

/**
 * Generates a markdown comparison report
 */
function generateMarkdownReport(
  result: ComparisonResult,
  title: string
): string {
  let markdown = `# ${title}\n\n`;
  
  markdown += `## Comparison Summary\n\n`;
  markdown += `Best overall approach: **${result.bestOverall}**\n\n`;
  markdown += result.summary + '\n\n';
  
  markdown += `## Metrics Comparison\n\n`;
  
  // Table header
  markdown += `| Metric | ${result.names.join(' | ')} | Best |\n`;
  markdown += `| ------ | ${result.names.map(() => '----').join(' | ')} | ---- |\n`;
  
  // Table rows
  result.metrics.forEach(metric => {
    markdown += `| ${metric.label} | `;
    
    metric.values.forEach((value, i) => {
      const isWinner = value === (metric.higherIsBetter ? Math.max(...metric.values) : Math.min(...metric.values));
      
      markdown += (isWinner ? '**' : '') +
        `${value}${metric.unit} ${metric.percentageDiff[i] !== 0 ? `(${metric.percentageDiff[i] > 0 ? '+' : ''}${metric.percentageDiff[i].toFixed(1)}%)` : ''}` +
        (isWinner ? '**' : '') + ' | ';
    });
    
    markdown += `${result.winners[metric.name]} |\n`;
  });
  
  return markdown;
}

/**
 * Generates a console comparison report
 */
function generateConsoleReport(
  result: ComparisonResult,
  title: string
): string {
  const lines: string[] = [];
  
  // Title
  lines.push(title);
  lines.push('='.repeat(title.length));
  lines.push('');
  
  // Summary
  lines.push('Comparison Summary');
  lines.push('-'.repeat('Comparison Summary'.length));
  lines.push(`Best overall approach: ${result.bestOverall}`);
  lines.push('');
  lines.push(result.summary);
  lines.push('');
  
  // Metrics Comparison
  lines.push('Metrics Comparison');
  lines.push('-'.repeat('Metrics Comparison'.length));
  lines.push('');
  
  // Calculate column widths
  const metricWidth = Math.max(
    ...result.metrics.map(m => m.label.length),
    'Metric'.length
  );
  
  const valueWidths = result.names.map(name => 
    Math.max(
      name.length,
      ...result.metrics.map(m => {
        const valueIndex = result.names.indexOf(name);
        return `${m.values[valueIndex]}${m.unit}`.length + 10; // Add space for percentage
      })
    )
  );
  
  const bestWidth = Math.max(
    'Best'.length,
    ...Object.values(result.winners).map(w => w.length)
  );
  
  // Header row
  let header = padRight('Metric', metricWidth) + ' | ';
  result.names.forEach((name, i) => {
    header += padRight(name, valueWidths[i]) + ' | ';
  });
  header += padRight('Best', bestWidth);
  
  lines.push(header);
  lines.push('-'.repeat(header.length));
  
  // Metric rows
  result.metrics.forEach(metric => {
    let row = padRight(metric.label, metricWidth) + ' | ';
    
    metric.values.forEach((value, i) => {
      const isWinner = value === (metric.higherIsBetter ? Math.max(...metric.values) : Math.min(...metric.values));
      
      let valueStr = `${value}${metric.unit}`;
      if (metric.percentageDiff[i] !== 0) {
        valueStr += ` (${metric.percentageDiff[i] > 0 ? '+' : ''}${metric.percentageDiff[i].toFixed(1)}%)`;
      }
      
      row += padRight(isWinner ? `* ${valueStr} *` : valueStr, valueWidths[i]) + ' | ';
    });
    
    row += padRight(result.winners[metric.name], bestWidth);
    lines.push(row);
  });
  
  return lines.join('\n');
}

// Helper function to pad a string to a specific width
function padRight(str: string, width: number): string {
  return str + ' '.repeat(Math.max(0, width - str.length));
}

export const ComparisonReporter = {
  compareReports,
  generateComparisonReport,
};

export default ComparisonReporter;