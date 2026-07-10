#!/usr/bin/env sh
set -eu

rm -rf "${ZEPHYR_CACHE:-$HOME/.zephyr}"
pnpm --filter sample-webpack-application run build
