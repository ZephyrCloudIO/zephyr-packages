#!/bin/bash

# Script to run all examples and verify Zephyr creates a new version
#
# Usage:
#   ./examples/testing-matrix.sh
#
# Environment variables:
#   SAVE_LOGS=1           Save all build logs to the 'test-logs' directory

SUCCESS_COUNT=0
FAILURE_COUNT=0
TOTAL_EXAMPLES=0

# Create logs directory if SAVE_LOGS is enabled
if [[ "${SAVE_LOGS:-0}" == "1" ]]; then
  LOG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/test-logs"
  mkdir -p "$LOG_DIR"
  echo "Logs will be saved to: $LOG_DIR"
fi

# Print header
echo "=============================================="
echo "Zephyr Examples Testing Matrix"
echo "=============================================="
echo ""

function run_example() {
  local EXAMPLE_DIR=$1
  local EXAMPLE_NAME=$2
  local BUILD_CMD=$3

  ((TOTAL_EXAMPLES++))

  echo "Testing $EXAMPLE_NAME..."
  echo "Directory: $EXAMPLE_DIR"
  echo "Build command: $BUILD_CMD"

  # Move to example directory
  pushd "$EXAMPLE_DIR" > /dev/null || {
    echo "❌ Failed to enter directory $EXAMPLE_DIR"
    ((FAILURE_COUNT++))
    return 1
  }

  # Run the build command and capture the output
  echo "Running: $BUILD_CMD"
  eval "BUILD_OUTPUT=\$(COREPACK_ENABLE_STRICT=0 $BUILD_CMD 2>&1)"
  BUILD_STATUS=$?

  # Save logs to file if enabled
  if [[ "${SAVE_LOGS:-0}" == "1" ]]; then
    LOG_FILE="$LOG_DIR/${EXAMPLE_NAME// /_}.log"
    echo "Build Command: $BUILD_CMD" > "$LOG_FILE"
    echo "Build Status: $BUILD_STATUS" >> "$LOG_FILE"
    echo "Directory: $EXAMPLE_DIR" >> "$LOG_FILE"
    echo "=======================================" >> "$LOG_FILE"
    echo "$BUILD_OUTPUT" >> "$LOG_FILE"
    echo "Log saved to: $LOG_FILE"
  fi

  # Check for success indicators in the output
  # Support all formats of the output: with various formatting
  # Only check for successful exit code and presence of a Zephyr URL
  if [[ $BUILD_STATUS -eq 0 ]] && [[ $BUILD_OUTPUT =~ ZEPHYR.*https:// ]]; then
    echo "✅ SUCCESS: Zephyr deployed successfully"
    # Extract the URL that follows "ZEPHYR" text
    # Use grep -o to just get the URL, not the ZEPHYR prefix
    URL=$(echo "$BUILD_OUTPUT" | grep -E "ZEPHYR.*https://" | head -1 | sed 's/\[39m$//')
    echo "   URL: $URL"
    ((SUCCESS_COUNT++))
  else
    echo "❌ FAILURE: Zephyr did not deploy successfully"
    if [[ $BUILD_STATUS -ne 0 ]]; then
      echo "   Build command failed with status $BUILD_STATUS"
    fi
    if [[ ! $BUILD_OUTPUT =~ ZEPHYR.*https:// ]]; then
      echo "   Missing Zephyr URL in output"
    fi

    # Always display the build output for failed builds
    echo ""
    echo "   --- Build Output ---"
    echo "$BUILD_OUTPUT"
    echo "   --- End of Build Output ---"
    echo ""

    ((FAILURE_COUNT++))
  fi

  # Return to original directory
  popd > /dev/null

  echo ""
}

# Define the examples to test
# format: run_example "directory" "name" "build command"

# Get the root directory of the repo
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLES_DIR="$REPO_ROOT/examples"

# Vite examples
run_example "$EXAMPLES_DIR/vite-react-ts" "Vite React TS" "pnpm build"
run_example "$EXAMPLES_DIR/vite-react-mf/host" "Vite MF Host" "pnpm build"
run_example "$EXAMPLES_DIR/vite-react-mf/remote" "Vite MF Remote" "pnpm build"

# Rolldown example
run_example "$EXAMPLES_DIR/rolldown-react" "Rolldown React" "pnpm build"

# Rollup example
run_example "$EXAMPLES_DIR/rollup-sample-lib" "Rollup Sample Lib" "nx build rollup-sample-lib"

# Rspack examples
run_example "$EXAMPLES_DIR/rspack-sample-app" "Rspack Sample App" "pnpm build"
run_example "$EXAMPLES_DIR/rspack-mf/apps/host" "Rspack MF Host" "nx build"
run_example "$EXAMPLES_DIR/rspack-mf/apps/remote" "Rspack MF Remote" "nx build"

# Webpack examples
run_example "$EXAMPLES_DIR/sample-webpack-application" "Sample Webpack App" "nx build sample-webpack-application"

# Modern.js examples
# run_example "$EXAMPLES_DIR/modern-js" "Modern JS" "pnpm build"
# todo: fix EPIPE issues in modern.js

# error   Error: write EPIPE
#     at WriteWrap.onWriteComplete [as oncomplete] (node:internal/stream_base_commons:87:19)
#  ELIFECYCLE  Command failed with exit code 1.


# Parcel examples
run_example "$EXAMPLES_DIR/parcel-react" "Parcel React" "pnpm build"

# Print summary
echo "=============================================="
echo "Testing Matrix Summary"
echo "=============================================="
echo "Total examples tested: $TOTAL_EXAMPLES"
echo "Successful: $SUCCESS_COUNT"
echo "Failed: $FAILURE_COUNT"

# Exit with error if any tests failed
if [ $FAILURE_COUNT -gt 0 ]; then
  exit 1
fi

exit 0
