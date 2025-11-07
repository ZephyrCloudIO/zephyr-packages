# Structured Output and File Logging for Zephyr Bundler Plugins

This document describes the structured output and file logging features for Zephyr bundler plugins, enabling machine-readable JSON output and persistent log files for CI/CD integration and debugging.

## Overview

All Zephyr bundler plugins now support two output formats:
- **plain** (default): Human-readable output with colors and formatting
- **json**: Structured, machine-parsable JSON output

This works automatically with all bundler plugins including:
- webpack (`zephyr-webpack-plugin`)
- rspack (`zephyr-rspack-plugin`)
- vite (`vite-plugin-zephyr`)
- rollup (`rollup-plugin-zephyr`)
- parcel (`parcel-reporter-zephyr`)
- astro (`zephyr-astro-integration`)
- and all other Zephyr bundler integrations

## Usage

### Console Output

#### Environment Variables

**Primary Method: ZEPHYR_OUTPUT_FORMAT**

```bash
# Enable JSON output during build
ZEPHYR_OUTPUT_FORMAT=json npm run build

# Enable JSON output for Vite
ZEPHYR_OUTPUT_FORMAT=json vite build

# Enable JSON output for Webpack
ZEPHYR_OUTPUT_FORMAT=json webpack

# Enable JSON output for Rspack
ZEPHYR_OUTPUT_FORMAT=json rspack build
```

**Legacy Method: ZEPHYR_STRUCTURED_OUTPUT**

For backward compatibility, the legacy environment variable is still supported:

```bash
# Enable JSON output (legacy)
ZEPHYR_STRUCTURED_OUTPUT=true npm run build
```

### File Logging

Write logs to files in `~/.zephyr/logs/` for persistent debugging and analysis:

```bash
# Enable file logging
ZEPHYR_LOG_TO_FILE=true npm run build

# Enable both file logging and JSON console output
ZEPHYR_LOG_TO_FILE=true ZEPHYR_OUTPUT_FORMAT=json npm run build

# Enable file logging with DEBUG logs
DEBUG=zephyr:* ZEPHYR_LOG_TO_FILE=true npm run build

# Use a custom log directory
ZEPHYR_LOG_PATH=/path/to/logs ZEPHYR_LOG_TO_FILE=true npm run build

# Use TOON format for token-efficient logging
ZEPHYR_LOG_FORMAT=toon ZEPHYR_LOG_TO_FILE=true npm run build

# Combine TOON format with custom path
ZEPHYR_LOG_FORMAT=toon ZEPHYR_LOG_PATH=./logs ZEPHYR_LOG_TO_FILE=true npm run build
```

**Environment Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `ZEPHYR_LOG_TO_FILE` | Enable file logging | `false` |
| `ZEPHYR_LOG_PATH` | Custom directory for logs | `~/.zephyr/logs` |
| `ZEPHYR_LOG_FORMAT` | Log file format: `json` or `toon` | `json` |

**Important**: When `ZEPHYR_LOG_TO_FILE=true`, **ALL logs** (including all debug contexts) are written to files regardless of the `DEBUG` environment variable. The `DEBUG` variable only controls console output. This means:
- `ZEPHYR_LOG_TO_FILE=true npm run build` - Writes all debug logs to files, no debug console output
- `DEBUG=zephyr:* ZEPHYR_LOG_TO_FILE=true npm run build` - Writes all debug logs to files AND shows debug console output

**Log Directory Structure:**

Default location with JSON format (`~/.zephyr/logs/`):
```
~/.zephyr/logs/
├── run-2025-11-07T12-34-56/
│   ├── summary.json              # Build metadata
│   ├── info.log                  # All info-level logs (JSON)
│   ├── error.log                 # All error-level logs (JSON)
│   ├── warn.log                  # All warning-level logs (JSON)
│   ├── debug-init.log            # Initialization debug logs (JSON)
│   ├── debug-http.log            # HTTP request debug logs (JSON)
│   ├── debug-upload.log          # Upload debug logs (JSON)
│   ├── action-build-info-user.log    # User info logs (JSON)
│   ├── action-deploy-url.log         # Deployment URL logs (JSON)
│   └── ...                       # Other action-specific logs
└── run-2025-11-07T15-20-10/
    └── ...
```

With TOON format (`ZEPHYR_LOG_FORMAT=toon`):
```
~/.zephyr/logs/
├── run-2025-11-07T12-34-56/
│   ├── summary.json              # Build metadata
│   ├── info.toon                 # All info-level logs (TOON)
│   ├── error.toon                # All error-level logs (TOON)
│   ├── warn.toon                 # All warning-level logs (TOON)
│   ├── debug-init.toon           # Initialization debug logs (TOON)
│   ├── debug-http.toon           # HTTP request debug logs (TOON)
│   ├── debug-upload.toon         # Upload debug logs (TOON)
│   ├── action-build-info-user.toon   # User info logs (TOON)
│   ├── action-deploy-url.toon        # Deployment URL logs (TOON)
│   └── ...                       # Other action-specific logs
└── run-2025-11-07T15-20-10/
    └── ...
```

Custom location (with `ZEPHYR_LOG_PATH=/var/log/my-app`):
```
/var/log/my-app/
├── run-2025-11-07T12-34-56/
│   └── ... (same structure as above)
└── run-2025-11-07T15-20-10/
    └── ...
```

**Log File Format:**

Logs can be written in either JSON or TOON format based on the `ZEPHYR_LOG_FORMAT` environment variable.

**JSON Format (default):** Each log file contains one JSON object per line:

```json
{"level":"info","message":"Hi nestor_lopez!","action":"build:info:user","timestamp":1699363496789}
{"level":"debug","message":"[POST][https://ze.zephyrcloud.app/upload]: 146ms","action":"debug:http","timestamp":1699363497012}
{"level":"info","message":"Deployed to Zephyr's edge in 208ms.","action":"deploy:url","timestamp":1699363497223}
```

**TOON Format:** Token-efficient format with ~30-60% fewer tokens than JSON. Each entry is indented with field names:

```
level: info
message: Hi nestor_lopez!
action: build:info:user
timestamp: 1699363496789

level: debug
message: [POST][https://ze.zephyrcloud.app/upload]: 146ms
action: debug:http
timestamp: 1699363497012

level: info
message: Deployed to Zephyr's edge in 208ms.
action: deploy:url
timestamp: 1699363497223
```

**Why TOON?** TOON (Token-Oriented Object Notation) is designed for LLM contexts where token efficiency matters. It uses fewer tokens than JSON while maintaining structure that LLMs can easily parse. Use TOON format when:
- Sending logs to LLMs for analysis
- Token costs are a concern
- You need human-readable logs that are also machine-parseable

## JSON Output Format

When structured output is enabled, all log messages are output as single-line JSON objects:

```json
{
  "level": "info",
  "message": "Build completed successfully",
  "action": "build:complete",
  "data": {
    "duration": "2.3s",
    "files": 42
  },
  "timestamp": 1234567890123
}
```

### JSON Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `level` | string | Yes | Log level: `info`, `warn`, `error`, or `debug` |
| `message` | string | Yes | The log message (ANSI codes stripped) |
| `action` | string | No | Action type (e.g., `build:complete`, `deploy:url`) |
| `data` | object | No | Additional structured data |
| `timestamp` | number | Yes | Unix timestamp in milliseconds |

## Common Action Types

Bundler plugins emit the following action types:

| Action | Description | Level |
|--------|-------------|-------|
| `build:start` | Build process started | info |
| `build:info:user` | User and build information | info |
| `build:remotes:resolved` | Remote dependencies resolved | info |
| `build:error:dependency_resolution` | Failed to resolve dependencies | warn/error |
| `deploy:url` | Deployment URL and timing | info |
| `deploy:complete` | Build deployment completed | info |

## Examples

### CI/CD Integration (GitHub Actions)

```yaml
name: Build and Deploy

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build with Zephyr
        id: build
        run: |
          ZEPHYR_OUTPUT_FORMAT=json npm run build 2>&1 | tee build.log

      - name: Extract Deployment URL
        id: deploy_url
        run: |
          URL=$(cat build.log | jq -r 'select(.action == "deploy:url") | .message' | head -1)
          echo "url=$URL" >> $GITHUB_OUTPUT
          echo "Deployed to: $URL"

      - name: Check for Errors
        run: |
          ERRORS=$(cat build.log | jq -r 'select(.level == "error")')
          if [ ! -z "$ERRORS" ]; then
            echo "Build errors detected:"
            echo "$ERRORS"
            exit 1
          fi

      - name: Comment PR with Deployment URL
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Deployed to: ${{ steps.deploy_url.outputs.url }}'
            })
```

### Parsing with jq

```bash
# Get deployment URL
ZEPHYR_OUTPUT_FORMAT=json npm run build 2>&1 | \
  jq -r 'select(.action == "deploy:url") | .message'

# Filter only errors
ZEPHYR_OUTPUT_FORMAT=json vite build 2>&1 | \
  jq 'select(.level == "error")'

# Extract build timing data
ZEPHYR_OUTPUT_FORMAT=json webpack 2>&1 | \
  jq 'select(.action == "deploy:url") | .data.buildTime'

# Count resolved dependencies
ZEPHYR_OUTPUT_FORMAT=json npm run build 2>&1 | \
  jq 'select(.action == "build:remotes:resolved")' | \
  wc -l

# Get all warnings
ZEPHYR_OUTPUT_FORMAT=json rspack build 2>&1 | \
  jq -r 'select(.level == "warn") | .message'
```

### Node.js Integration

```javascript
import { spawn } from 'child_process';

// Run build with structured output
const buildProcess = spawn('npm', ['run', 'build'], {
  env: { ...process.env, ZEPHYR_OUTPUT_FORMAT: 'json' }
});

let deploymentUrl = null;
const errors = [];

buildProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');

  lines.forEach(line => {
    if (line.trim()) {
      try {
        const log = JSON.parse(line);

        // Extract deployment URL
        if (log.action === 'deploy:url') {
          deploymentUrl = log.message;
          console.log('Deployed to:', deploymentUrl);
        }

        // Track errors
        if (log.level === 'error') {
          errors.push(log.message);
        }

        // Log with formatting
        console.log(`[${log.level.toUpperCase()}] ${log.message}`);

      } catch (e) {
        // Not JSON, might be other output
        console.log(line);
      }
    }
  });
});

buildProcess.on('close', (code) => {
  if (errors.length > 0) {
    console.error('Build completed with errors:');
    errors.forEach(err => console.error('  -', err));
  }

  if (deploymentUrl) {
    console.log(`\n✅ Success! Deployed to: ${deploymentUrl}`);
  }

  process.exit(code);
});
```

### Shell Script Integration

```bash
#!/bin/bash

# Build with JSON output and capture logs
ZEPHYR_OUTPUT_FORMAT=json npm run build 2>&1 | tee build.log

# Parse the output
DEPLOY_URL=$(cat build.log | jq -r 'select(.action == "deploy:url") | .message' | head -1)
ERROR_COUNT=$(cat build.log | jq -r 'select(.level == "error")' | wc -l)

# Check for errors
if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "❌ Build failed with $ERROR_COUNT error(s)"
  cat build.log | jq -r 'select(.level == "error") | .message'
  exit 1
fi

# Report success
if [ ! -z "$DEPLOY_URL" ]; then
  echo "✅ Build successful!"
  echo "🚀 Deployed to: $DEPLOY_URL"

  # Post to Slack, Discord, etc.
  curl -X POST "$WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"text\": \"Deployed to: $DEPLOY_URL\"}"
else
  echo "⚠️  Build completed but no deployment URL found"
fi
```

## Backward Compatibility

The structured output feature is fully backward compatible:

- **Default behavior unchanged**: Without any configuration, output remains in plain format with colors
- **Legacy support**: The `ZEPHYR_STRUCTURED_OUTPUT=true` environment variable continues to work
- **No breaking changes**: Existing scripts and workflows will continue to function

## Implementation Details

### Affected Packages

- **zephyr-agent**: Core output formatting and configuration
  - `output-config.ts`: Configuration management
  - `output-formatter.ts`: Output formatting logic
  - `ze-log-event.ts`: Updated logging functions

- **with-zephyr**: Codemod CLI tool
  - Added `--output-format` flag
  - Updated console output to use formatter

### Analyzing Log Files

#### JSON Format Logs

```bash
# View latest build summary
LATEST_RUN=$(ls -t ~/.zephyr/logs | head -1)
cat ~/.zephyr/logs/$LATEST_RUN/summary.json | jq .

# Find all errors in latest run (parse JSON)
cat ~/.zephyr/logs/$LATEST_RUN/error.log | jq -r '.message'

# View HTTP requests from latest build
cat ~/.zephyr/logs/$LATEST_RUN/debug-http.log | jq .

# Get deployment URLs from all runs
cat ~/.zephyr/logs/*/action-deploy-url.log | jq -r '.message'

# Count errors by searching all error log files
cat ~/.zephyr/logs/*/error.log | jq -s 'length'

# Filter logs by timestamp (last hour)
HOUR_AGO=$(($(date +%s) * 1000 - 3600000))
cat ~/.zephyr/logs/$LATEST_RUN/info.log | jq -r "select(.timestamp > $HOUR_AGO)"

# Extract specific action logs
cat ~/.zephyr/logs/$LATEST_RUN/action-deploy-url.log | jq -r '.message'
```

#### TOON Format Logs

TOON logs are human-readable and can be analyzed with standard text tools:

```bash
LATEST_RUN=$(ls -t ~/.zephyr/logs | head -1)

# View all error messages (grep for message lines)
grep "^message:" ~/.zephyr/logs/$LATEST_RUN/error.toon

# Count errors (count log entries by counting "level: error" lines)
grep -c "^level: error" ~/.zephyr/logs/$LATEST_RUN/error.toon

# Extract deployment URLs
grep "^message:" ~/.zephyr/logs/$LATEST_RUN/action-deploy-url.toon | sed 's/^message: //'

# View all HTTP debug logs
cat ~/.zephyr/logs/$LATEST_RUN/debug-http.toon

# Find specific action types
grep "^action:" ~/.zephyr/logs/$LATEST_RUN/info.toon | sort | uniq

# Extract timestamps
grep "^timestamp:" ~/.zephyr/logs/$LATEST_RUN/info.toon
```

### Real-World Use Cases

#### 1. Automated Deployment Notifications

```bash
# Deploy and notify team via Slack
DEPLOY_URL=$(ZEPHYR_OUTPUT_FORMAT=json npm run build 2>&1 | \
  jq -r 'select(.action == "deploy:url") | .message' | head -1)

curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d "{\"text\": \"New deployment: $DEPLOY_URL\"}"
```

#### 2. Build Metrics Collection

```javascript
// collect-metrics.js
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

const metrics = {
  buildTime: null,
  deploymentUrl: null,
  errors: [],
  warnings: [],
  resolvedDependencies: []
};

const build = spawn('npm', ['run', 'build'], {
  env: { ...process.env, ZEPHYR_OUTPUT_FORMAT: 'json' }
});

build.stdout.on('data', (data) => {
  data.toString().split('\n').forEach(line => {
    if (!line.trim()) return;
    try {
      const log = JSON.parse(line);

      if (log.action === 'deploy:url') {
        metrics.deploymentUrl = log.message;
        metrics.buildTime = log.data?.buildTime;
      }
      if (log.level === 'error') metrics.errors.push(log.message);
      if (log.level === 'warn') metrics.warnings.push(log.message);
      if (log.action === 'build:remotes:resolved') {
        metrics.resolvedDependencies.push(log.message);
      }
    } catch {}
  });
});

build.on('close', () => {
  writeFileSync('build-metrics.json', JSON.stringify(metrics, null, 2));
  console.log('Metrics saved to build-metrics.json');
});
```

#### 3. Deployment Verification

```bash
#!/bin/bash
# verify-deployment.sh

echo "Building application..."
BUILD_LOG=$(ZEPHYR_OUTPUT_FORMAT=json npm run build 2>&1)

# Extract URL
URL=$(echo "$BUILD_LOG" | jq -r 'select(.action == "deploy:url") | .message' | head -1)

if [ -z "$URL" ]; then
  echo "❌ Failed to get deployment URL"
  exit 1
fi

echo "🔍 Verifying deployment at $URL"

# Check if deployment is accessible
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ Deployment verified successfully"
else
  echo "❌ Deployment returned HTTP $HTTP_CODE"
  exit 1
fi
```

#### 4. Build Debugging with Log Files

```bash
#!/bin/bash
# debug-build.sh

# Run build with file logging and capture errors
ZEPHYR_LOG_TO_FILE=true DEBUG=zephyr:* npm run build

# Get the latest run directory
LATEST_RUN=$(ls -t ~/.zephyr/logs | head -1)
LOG_DIR="$HOME/.zephyr/logs/$LATEST_RUN"

echo "📂 Logs saved to: $LOG_DIR"

# Check for errors (parse JSON)
if [ -f "$LOG_DIR/error.log" ]; then
  ERROR_COUNT=$(cat "$LOG_DIR/error.log" | jq -s 'length')
  if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "❌ Found $ERROR_COUNT error(s):"
    cat "$LOG_DIR/error.log" | jq -r '.message'
    exit 1
  fi
fi

# Show summary
if [ -f "$LOG_DIR/summary.json" ]; then
  echo "📊 Build Summary:"
  cat "$LOG_DIR/summary.json" | jq .
fi

echo "✅ Build completed successfully"
```

#### 5. CI/CD with Artifact Preservation

```yaml
# .github/workflows/build.yml
name: Build with Log Artifacts

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build with logging
        run: |
          ZEPHYR_LOG_TO_FILE=true DEBUG=zephyr:* npm run build

      - name: Upload logs as artifacts
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: build-logs
          path: ~/.zephyr/logs/
          retention-days: 30

      - name: Check for errors
        run: |
          LATEST_RUN=$(ls -t ~/.zephyr/logs | head -1)
          LOG_DIR="$HOME/.zephyr/logs/$LATEST_RUN"
          if [ -f "$LOG_DIR/error.log" ] && [ -s "$LOG_DIR/error.log" ]; then
            echo "Errors found in build:"
            cat "$LOG_DIR/error.log" | jq -r '.message'
            exit 1
          fi
```

#### 6. CI/CD with Custom Log Path

```yaml
# .github/workflows/build-custom-path.yml
name: Build with Custom Log Path

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Create log directory
        run: mkdir -p ${{ github.workspace }}/build-logs

      - name: Build with custom log path
        run: |
          ZEPHYR_LOG_PATH=${{ github.workspace }}/build-logs \
          ZEPHYR_LOG_TO_FILE=true \
          DEBUG=zephyr:* \
          npm run build

      - name: Upload logs as artifacts
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: build-logs
          path: ${{ github.workspace }}/build-logs/
          retention-days: 30

      - name: Check for errors
        run: |
          LATEST_RUN=$(ls -t ${{ github.workspace }}/build-logs | head -1)
          LOG_DIR="${{ github.workspace }}/build-logs/$LATEST_RUN"
          if [ -f "$LOG_DIR/error.log" ] && [ -s "$LOG_DIR/error.log" ]; then
            echo "Errors found in build:"
            cat "$LOG_DIR/error.log" | jq -r '.message'
            exit 1
          fi
```

## Testing

Run the following command to verify structured output:

```bash
# Test JSON output
ZEPHYR_OUTPUT_FORMAT=json with-zephyr --help 2>&1 | head -5

# Test plain output (default)
with-zephyr --help 2>&1 | head -5
```

## Troubleshooting

### Colors appear in JSON output

If you see ANSI color codes in JSON output, ensure you're using the latest version of zephyr-agent. The formatter automatically strips ANSI codes in JSON mode.

### Environment variable not working

Check the variable name and value:
```bash
echo $ZEPHYR_OUTPUT_FORMAT  # Should be 'json' or 'plain'
```

Ensure the variable is exported:
```bash
export ZEPHYR_OUTPUT_FORMAT=json
```

### JSON parsing errors

Each line of output is a separate JSON object. Parse line by line:
```bash
while IFS= read -r line; do
  echo "$line" | jq .
done
```

## Performance Considerations

Structured output has minimal performance impact:
- **Plain mode**: No overhead, standard console output with colors
- **JSON mode**: Slight overhead for JSON serialization and ANSI stripping (~1-2ms per log)
- **Build time**: No measurable impact on total build time

## Debugging

### Enable verbose logging

DEBUG logs also respect structured output format! When you enable DEBUG logging with JSON output, all debug messages are formatted as JSON:

```bash
# DEBUG logs as JSON
DEBUG=zephyr:* ZEPHYR_OUTPUT_FORMAT=json npm run build
```

This outputs debug logs with action types like:
- `debug:init` - Initialization logs
- `debug:git` - Git information
- `debug:package` - Package.json parsing
- `debug:auth` - Authentication status
- `debug:http` - HTTP requests
- `debug:upload` - Asset uploads
- `debug:snapshot` - Snapshot creation

Example DEBUG JSON output:
```json
{"level":"debug","message":"Initializing: Zephyr Engine for /path/to/project...","action":"debug:init","timestamp":1762517166793}
{"level":"debug","message":"Found package.json at /path/to/package.json","action":"debug:package","timestamp":1762517166802}
```

### Filter debug logs by context

```bash
# Get only HTTP debug logs
DEBUG=zephyr:* ZEPHYR_OUTPUT_FORMAT=json npm run build 2>&1 | \
  jq 'select(.action == "debug:http")'

# Get only initialization logs
DEBUG=zephyr:* ZEPHYR_OUTPUT_FORMAT=json npm run build 2>&1 | \
  jq 'select(.action == "debug:init")'
```

### Validate JSON output

Pipe through jq to validate:

```bash
ZEPHYR_OUTPUT_FORMAT=json npm run build 2>&1 | jq empty
```

If there are JSON parsing errors, check for:
- Mixed plain and JSON output (should be all one format)
- Third-party plugin output interfering
- Unescaped newlines in messages

## Future Enhancements

Planned additions:
- Additional output formats (YAML, XML)
- Progress indicators in JSON mode
- Build performance metrics in structured format
- Integration with observability platforms (DataDog, New Relic, etc.)
