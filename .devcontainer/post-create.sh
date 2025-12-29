#!/bin/bash
set -e

echo "🚀 Running post-create setup..."

# Ensure node_modules directory exists with correct permissions
if [ ! -d "node_modules" ]; then
    echo "📁 Creating node_modules directory..."
    mkdir -p node_modules
fi

# Fix ownership of node_modules in case it was created with wrong permissions
echo "🔧 Fixing node_modules permissions..."
sudo chown -R node:node node_modules 2>/dev/null || true

# Install dependencies with pnpm
if [ -f "package.json" ]; then
    echo "📦 Installing dependencies with pnpm..."
    pnpm install

    # Fix permissions again after install
    echo "🔧 Fixing permissions after install..."
    sudo chown -R node:node node_modules 2>/dev/null || true
else
    echo "⚠️  No package.json found, skipping dependency installation"
fi

# Verify git configuration
echo "🔍 Verifying git configuration..."
git config --global --get user.name || echo "⚠️  Git user.name not set. Run: git config --global user.name 'Your Name'"
git config --global --get user.email || echo "⚠️  Git user.email not set. Run: git config --global user.email 'your.email@example.com'"

# Verify pnpm installation
if command -v pnpm &> /dev/null; then
    echo "✅ pnpm is installed"
    pnpm --version
else
    echo "❌ pnpm not found in PATH"
fi

# Verify git-lfs
if command -v git-lfs &> /dev/null; then
    echo "✅ git-lfs is installed"
    git lfs version
else
    echo "❌ git-lfs not found"
fi

echo "✨ Post-create setup complete!"
