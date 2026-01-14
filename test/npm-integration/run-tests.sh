#!/usr/bin/env bash
#
# npm Integration Tests
#
# This script verifies that the built package works correctly when installed
# via npm in ESM, CJS, and TypeScript environments.
#
# Usage:
#   ./test/npm-integration/run-tests.sh
#   pnpm test:npm-integration
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${YELLOW}→${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

cleanup() {
  log_info "Cleaning up..."
  rm -f "$ROOT_DIR"/*.tgz
  rm -rf "$SCRIPT_DIR/esm/node_modules"
  rm -rf "$SCRIPT_DIR/cjs/node_modules"
  rm -rf "$SCRIPT_DIR/typescript/node_modules"
  rm -f "$SCRIPT_DIR/esm/package-lock.json"
  rm -f "$SCRIPT_DIR/cjs/package-lock.json"
  rm -f "$SCRIPT_DIR/typescript/package-lock.json"
}

# Cleanup on exit
trap cleanup EXIT

echo ""
echo "========================================"
echo "  npm Integration Tests"
echo "========================================"
echo ""

cd "$ROOT_DIR"

# Step 1: Build the package
log_info "Building package..."
pnpm build
log_success "Package built"

# Step 2: Create tarball
log_info "Creating npm tarball..."
TARBALL=$(npm pack --pack-destination "$ROOT_DIR" 2>/dev/null | tail -n1)
TARBALL_PATH="$ROOT_DIR/$TARBALL"
log_success "Created $TARBALL"

# Step 3: Run ESM tests
echo ""
log_info "Running ESM integration tests..."
cd "$SCRIPT_DIR/esm"
npm install "$TARBALL_PATH" --silent
node test.mjs
log_success "ESM tests passed"

# Step 4: Run CJS tests
echo ""
log_info "Running CJS integration tests..."
cd "$SCRIPT_DIR/cjs"
npm install "$TARBALL_PATH" --silent
node test.cjs
log_success "CJS tests passed"

# Step 5: Run TypeScript type tests
echo ""
log_info "Running TypeScript type definition tests..."
cd "$SCRIPT_DIR/typescript"
npm install "$TARBALL_PATH" --silent
npm install --silent
npx tsc --noEmit
log_success "TypeScript type definitions are valid"

echo ""
echo "========================================"
echo -e "  ${GREEN}All npm integration tests passed!${NC}"
echo "========================================"
echo ""
