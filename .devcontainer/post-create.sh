#!/bin/bash
set -e

echo "🚀 Running post-create setup..."

# Fix ownership of /home/node/.local (volumes may be owned by root)
echo "🔧 Fixing /home/node/.local permissions..."
sudo chown -R node:node /home/node/.local 2>/dev/null || true

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
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install

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

# Verify Bun installation
if command -v bun &> /dev/null; then
    echo "✅ Bun is installed"
    bun --version
else
    echo "❌ Bun not found in PATH"
fi

# Verify Deno installation
if command -v deno &> /dev/null; then
    echo "✅ Deno is installed"
    deno --version
else
    echo "❌ Deno not found in PATH"
fi

# Verify git-lfs
if command -v git-lfs &> /dev/null; then
    echo "✅ git-lfs is installed"
    git lfs version
else
    echo "❌ git-lfs not found"
fi

# Verify GitHub CLI
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI is installed"
    gh --version
else
    echo "❌ GitHub CLI not found"
fi

# Install Claude Code
echo "📦 Installing Claude Code..."
curl -fsSL https://claude.ai/install.sh | bash
if command -v claude &> /dev/null; then
    echo "✅ Claude Code is installed"
    claude --version
else
    echo "❌ Claude Code installation failed"
fi

# Install Codex CLI
echo "📦 Installing Codex CLI..."
npm install -g @openai/codex
if command -v codex &> /dev/null; then
    echo "✅ Codex CLI is installed"
    codex --version
else
    echo "❌ Codex CLI installation failed"
fi

echo ""
echo "📋 Available test commands:"
echo "   pnpm test        - Run Node.js tests (vitest)"
echo "   pnpm test:bun    - Run Bun smoke tests"
echo "   pnpm test:deno   - Run Deno smoke tests"
echo ""

echo "✨ Post-create setup complete!"
