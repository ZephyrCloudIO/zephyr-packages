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

# Vite + Rolldown MF 2.0 examples
run_example "$EXAMPLES_DIR/vite-rolldown-mf2/host" "Vite Rolldown MF2 Host" "pnpm build"
run_example "$EXAMPLES_DIR/vite-rolldown-mf2/remote" "Vite Rolldown MF2 Remote" "pnpm build"

# Rolldown example
run_example "$EXAMPLES_DIR/rolldown-react" "Rolldown React" "pnpm build"

# Rollup example
run_example "$EXAMPLES_DIR/rollup-sample-lib" "Rollup Sample Lib" "nx build rollup-sample-lib"

# Rspack examples
run_example "$EXAMPLES_DIR/rspack-sample-app" "Rspack Sample App" "pnpm build"
run_example "$EXAMPLES_DIR/rspack-mf/apps/host" "Rspack MF Host" "nx build"
run_example "$EXAMPLES_DIR/rspack-mf/apps/remote" "Rspack MF Remote" "nx build"

# Rspack MF 2.0 examples
run_example "$EXAMPLES_DIR/rspack-mf2/host" "Rspack MF2 Host" "pnpm build"
run_example "$EXAMPLES_DIR/rspack-mf2/remote" "Rspack MF2 Remote" "pnpm build"

# Advanced features demo
# TODO: Commenting this out until it makes sense
# run_example "$EXAMPLES_DIR/advanced-features-demo" "Advanced Features Demo" "echo 'Demo module built successfully'"

# SSR Examples
# TODO: Commenting out these because they are NextJS based
#run_example "$EXAMPLES_DIR/nextjs-ssr-basic/host" "Next.js Basic SSR Host" "pnpm build"
#run_example "$EXAMPLES_DIR/nextjs-ssr-basic/remote" "Next.js Basic SSR Remote" "pnpm build"
#
# TODO: Commenting out these because they are NextJS based
#run_example "$EXAMPLES_DIR/multi-remote-ssr/host" "Multi-Remote SSR Host" "pnpm build"
#run_example "$EXAMPLES_DIR/multi-remote-ssr/remote-a" "Multi-Remote SSR Remote A" "pnpm build"
#run_example "$EXAMPLES_DIR/multi-remote-ssr/remote-b" "Multi-Remote SSR Remote B" "pnpm build"
#run_example "$EXAMPLES_DIR/multi-remote-ssr/remote-c" "Multi-Remote SSR Remote C" "pnpm build"
# TODO: Commenting out these because they are NextJS based
#run_example "$EXAMPLES_DIR/hybrid-ssr-csr/host" "Hybrid SSR/CSR Host" "pnpm build"
#run_example "$EXAMPLES_DIR/hybrid-ssr-csr/ssr-remote" "Hybrid SSR Remote" "pnpm build"
#run_example "$EXAMPLES_DIR/hybrid-ssr-csr/csr-remote" "Hybrid CSR Remote" "pnpm build"
#
# TODO: Commenting out these because they are NextJS based
#run_example "$EXAMPLES_DIR/streaming-ssr/host" "Streaming SSR Host" "pnpm build"
#run_example "$EXAMPLES_DIR/streaming-ssr/remote" "Streaming SSR Remote" "pnpm build"
#run_example "$EXAMPLES_DIR/streaming-ssr/shell" "Streaming SSR Shell" "pnpm build"

# BaseHref examples
run_example "$EXAMPLES_DIR/basehref-example/vite-app" "BaseHref Vite Example" "pnpm build"
run_example "$EXAMPLES_DIR/basehref-example/webpack-app" "BaseHref Webpack Example" "pnpm build"

# Remote Metadata examples
# TODO: Commenting this out until the remote remote-metadata capabilities are fixed
#run_example "$EXAMPLES_DIR/remote-metadata-example/host" "Remote Metadata Host" "pnpm build"
#run_example "$EXAMPLES_DIR/remote-metadata-example/remote-a" "Remote Metadata Next.js Remote" "pnpm build"
#run_example "$EXAMPLES_DIR/remote-metadata-example/remote-b" "Remote Metadata Vite Remote" "pnpm build"
#run_example "$EXAMPLES_DIR/remote-metadata-example/remote-c" "Remote Metadata Webpack Remote" "pnpm build"

# Remote Types examples
# TODO: Commenting this out until the remote types capabilities are fixed
#run_example "$EXAMPLES_DIR/remote-types-example/vite-app" "Remote Types Vite Example" "pnpm build"
#run_example "$EXAMPLES_DIR/remote-types-example/webpack-app" "Remote Types Webpack Example" "pnpm build"

# SSR Testing Infrastructure
# TODO: Commenting this out because it does not deploy to zephyr, need to evaluate where these tests live and how they are run
#run_example "$EXAMPLES_DIR/ssr-testing" "SSR Testing Infrastructure" "echo 'SSR Testing Infrastructure built successfully'"

# Webpack examples
run_example "$EXAMPLES_DIR/sample-webpack-application" "Sample Webpack App" "nx build sample-webpack-application"

# Modern.js examples
run_example "$EXAMPLES_DIR/modern-js" "Modern JS" "pnpm build"

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
