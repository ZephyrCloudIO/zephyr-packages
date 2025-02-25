#!/bin/bash

# Script to run all examples and verify Zephyr creates a new version

SUCCESS_COUNT=0
FAILURE_COUNT=0
TOTAL_EXAMPLES=0

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

  # Check for success indicators in the output
  # Support all formats of the output: with various formatting
  # Only check for successful exit code and presence of a Zephyr URL
  if [[ $BUILD_STATUS -eq 0 ]] && [[ $BUILD_OUTPUT =~ ZEPHYR.*https:// ]]; then
    echo "✅ SUCCESS: Zephyr deployed successfully"
    # Extract the URL that follows "ZEPHYR" text
    # Use grep -o to just get the URL, not the ZEPHYR prefix
    URL=$(echo "$BUILD_OUTPUT" | grep -E "ZEPHYR.*https://" | grep -o "https://[^[:space:]]*" | head -1 | sed 's/\[39m$//')
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

# Rolldown example still needs more work for full functionality
# run_example "$EXAMPLES_DIR/rolldown-react" "Rolldown React" "pnpm build"
echo "Skipping Rolldown React example as it requires further investigation"

# Rspack examples
run_example "$EXAMPLES_DIR/rspack-sample-app" "Rspack Sample App" "pnpm build"
run_example "$EXAMPLES_DIR/rspack-mf" "Rspack MF Host" "nx build rspack_mf_host"
run_example "$EXAMPLES_DIR/rspack-mf" "Rspack MF Remote" "nx build rspack_mf_remote"

# Webpack examples
run_example "$EXAMPLES_DIR/sample-webpack-application" "Sample Webpack App" "pnpm build"

# Modern.js examples
run_example "$EXAMPLES_DIR/modern-js" "Modern JS" "pnpm build"

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
