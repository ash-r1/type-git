# Microsoft TypeScript Dev Container
FROM mcr.microsoft.com/devcontainers/typescript-node:20

# Install Deno (system-wide)
ENV DENO_INSTALL="/usr/local"
RUN curl -fsSL https://deno.land/install.sh | sh -s -- -y --no-modify-path \
    && chmod +x /usr/local/bin/deno

# Switch to node user
USER node
WORKDIR /home/node

# Create directories with correct permissions (must be before corepack)
RUN mkdir -p \
    /home/node/.local/bin \
    /home/node/.local/share/pnpm/store \
    /home/node/.config/claude \
    /home/node/.local/share/claude \
    /home/node/.npm-global \
    /home/node/.deno

# Set environment variables
ENV PNPM_HOME="/home/node/.local/share/pnpm"
ENV BUN_INSTALL="/home/node/.bun"
ENV PATH="${BUN_INSTALL}/bin:${PNPM_HOME}:/home/node/.local/bin:${PATH}"

# Enable corepack for pnpm (user-level, no sudo required)
RUN corepack enable --install-directory /home/node/.local/bin

# Install Bun (user-level)
RUN curl -fsSL https://bun.sh/install | bash

# Set Deno environment variables
ENV DENO_DIR="/home/node/.deno"

# Set working directory to workspace
WORKDIR /workspace

# Keep container running
CMD ["sleep", "infinity"]
