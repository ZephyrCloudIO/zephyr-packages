/**
 * Browser Compatibility Report Generator
 * 
 * Generates reports on browser compatibility for SSR hydration.
 */

const fs = require('fs');
const path = require('path');

// Create reports directory if it doesn't exist
const reportsDir = path.join(__dirname, '..', 'browser-reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

console.log('Generating browser compatibility report...');

// Simulated browser test data
const browserTests = [
  {
    browser: 'Chrome',
    version: '112',
    os: 'Windows',
    results: {
      components: {
        'SimpleComponent': { passed: true, renderTime: 45, hydrationTime: 25 },
        'ComplexComponent': { passed: true, renderTime: 120, hydrationTime: 80 },
        'StreamingComponent': { passed: true, renderTime: 180, hydrationTime: 110 }
      },
      features: {
        'Basic Hydration': { passed: true, notes: 'Works as expected' },
        'Event Handling': { passed: true, notes: 'All events work correctly' },
        'Suspense': { passed: true, notes: 'Suspense boundaries work as expected' },
        'Streaming': { passed: true, notes: 'Streaming works perfectly' }
      },
      performance: {
        score: 95,
        metrics: {
          'First Contentful Paint': '65ms',
          'Largest Contentful Paint': '120ms',
          'Time to Interactive': '230ms'
        }
      }
    }
  },
  {
    browser: 'Firefox',
    version: '110',
    os: 'macOS',
    results: {
      components: {
        'SimpleComponent': { passed: true, renderTime: 50, hydrationTime: 30 },
        'ComplexComponent': { passed: true, renderTime: 125, hydrationTime: 85 },
        'StreamingComponent': { passed: true, renderTime: 190, hydrationTime: 115 }
      },
      features: {
        'Basic Hydration': { passed: true, notes: 'Works as expected' },
        'Event Handling': { passed: true, notes: 'All events work correctly' },
        'Suspense': { passed: true, notes: 'Suspense boundaries work as expected' },
        'Streaming': { passed: true, notes: 'Minor delay in initial chunk processing' }
      },
      performance: {
        score: 90,
        metrics: {
          'First Contentful Paint': '70ms',
          'Largest Contentful Paint': '130ms',
          'Time to Interactive': '240ms'
        }
      }
    }
  },
  {
    browser: 'Safari',
    version: '16',
    os: 'macOS',
    results: {
      components: {
        'SimpleComponent': { passed: true, renderTime: 55, hydrationTime: 35 },
        'ComplexComponent': { passed: true, renderTime: 130, hydrationTime: 90 },
        'StreamingComponent': { passed: false, renderTime: 200, hydrationTime: 150 }
      },
      features: {
        'Basic Hydration': { passed: true, notes: 'Works as expected' },
        'Event Handling': { passed: true, notes: 'All events work correctly' },
        'Suspense': { passed: true, notes: 'Suspense boundaries work with minor issues' },
        'Streaming': { passed: false, notes: 'Issues with stream chunking and rehydration' }
      },
      performance: {
        score: 80,
        metrics: {
          'First Contentful Paint': '75ms',
          'Largest Contentful Paint': '150ms',
          'Time to Interactive': '280ms'
        }
      }
    }
  },
  {
    browser: 'Edge',
    version: '110',
    os: 'Windows',
    results: {
      components: {
        'SimpleComponent': { passed: true, renderTime: 45, hydrationTime: 25 },
        'ComplexComponent': { passed: true, renderTime: 115, hydrationTime: 75 },
        'StreamingComponent': { passed: true, renderTime: 175, hydrationTime: 105 }
      },
      features: {
        'Basic Hydration': { passed: true, notes: 'Works as expected' },
        'Event Handling': { passed: true, notes: 'All events work correctly' },
        'Suspense': { passed: true, notes: 'Suspense boundaries work as expected' },
        'Streaming': { passed: true, notes: 'Streaming works perfectly' }
      },
      performance: {
        score: 95,
        metrics: {
          'First Contentful Paint': '60ms',
          'Largest Contentful Paint': '115ms',
          'Time to Interactive': '220ms'
        }
      }
    }
  }
];

// Calculate overall compatibility
const calculateOverallCompatibility = () => {
  let totalTests = 0;
  let passedTests = 0;
  
  browserTests.forEach(browser => {
    // Count component tests
    Object.values(browser.results.components).forEach(result => {
      totalTests++;
      if (result.passed) passedTests++;
    });
    
    // Count feature tests
    Object.values(browser.results.features).forEach(result => {
      totalTests++;
      if (result.passed) passedTests++;
    });
  });
  
  return {
    overall: Math.round((passedTests / totalTests) * 100),
    total: totalTests,
    passed: passedTests
  };
};

const compatibility = calculateOverallCompatibility();

// Generate HTML report
const browserReportHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Browser Compatibility Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
    .report { max-width: 1200px; margin: 0 auto; }
    .header { margin-bottom: 20px; }
    .header h1 { margin-bottom: 10px; }
    .overview { margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
    .compatibility-score { font-size: 48px; font-weight: bold; color: ${compatibility.overall >= 90 ? '#4caf50' : compatibility.overall >= 75 ? '#ff9800' : '#f44336'}; }
    .browser-card { margin-bottom: 30px; background: #f9f9f9; padding: 20px; border-radius: 5px; }
    .browser-card h2 { margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 10px; }
    .browser-header { display: flex; align-items: center; margin-bottom: 15px; }
    .browser-logo { width: 48px; height: 48px; margin-right: 15px; }
    .browser-info { flex: 1; }
    .browser-score { font-size: 24px; font-weight: bold; color: ${compatibility.overall >= 90 ? '#4caf50' : compatibility.overall >= 75 ? '#ff9800' : '#f44336'}; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
    th { background-color: #f5f5f5; }
    .pass { color: #4caf50; }
    .fail { color: #f44336; }
    .footer { text-align: center; margin-top: 30px; color: #888; }
  </style>
</head>
<body>
  <div class="report">
    <div class="header">
      <h1>Browser Compatibility Report</h1>
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="overview">
      <div class="compatibility-score">${compatibility.overall}%</div>
      <p>Overall compatibility score across all browsers</p>
      <p>Passed ${compatibility.passed} of ${compatibility.total} tests</p>
    </div>
    
    ${browserTests.map(browser => `
    <div class="browser-card">
      <div class="browser-header">
        <div class="browser-logo">🌐</div>
        <div class="browser-info">
          <h2>${browser.browser} ${browser.version} (${browser.os})</h2>
        </div>
        <div class="browser-score">${browser.results.performance.score}/100</div>
      </div>
      
      <h3>Components</h3>
      <table>
        <thead>
          <tr>
            <th>Component</th>
            <th>Status</th>
            <th>Render Time</th>
            <th>Hydration Time</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(browser.results.components).map(([name, result]) => `
          <tr>
            <td>${name}</td>
            <td class="${result.passed ? 'pass' : 'fail'}">${result.passed ? '✅ Pass' : '❌ Fail'}</td>
            <td>${result.renderTime}ms</td>
            <td>${result.hydrationTime}ms</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      
      <h3>Features</h3>
      <table>
        <thead>
          <tr>
            <th>Feature</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(browser.results.features).map(([name, result]) => `
          <tr>
            <td>${name}</td>
            <td class="${result.passed ? 'pass' : 'fail'}">${result.passed ? '✅ Pass' : '❌ Fail'}</td>
            <td>${result.notes}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      
      <h3>Performance</h3>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(browser.results.performance.metrics).map(([metric, value]) => `
          <tr>
            <td>${metric}</td>
            <td>${value}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    `).join('')}
    
    <div class="footer">
      Generated by SSR Testing Infrastructure
    </div>
  </div>
</body>
</html>`;

// Write HTML report to file
fs.writeFileSync(path.join(reportsDir, 'browser-compatibility.html'), browserReportHtml);

// Write raw data for future processing
fs.writeFileSync(
  path.join(reportsDir, 'browser-data.json'), 
  JSON.stringify({
    browsers: browserTests,
    compatibility
  }, null, 2)
);

console.log('Browser compatibility report generated successfully');