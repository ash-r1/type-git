FROM node:20-bullseye

# Install basic tools and unzip (required for Bun)
RUN apt-get update && apt-get install -y \
    git \
    git-lfs \
    curl \
    wget \
    sudo \
    vim \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Setup git-lfs
RUN git lfs install

# Setup node user with sudo access
RUN usermod -aG sudo node && \
    echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Install Deno (system-wide)
ENV DENO_INSTALL="/usr/local"
RUN curl -fsSL https://deno.land/install.sh | sh -s -- -y --no-modify-path \
    && chmod +x /usr/local/bin/deno

# Switch to node user
USER node
WORKDIR /home/node

# Install pnpm globally as node user with explicit shell
ENV SHELL=/bin/bash
RUN curl -fsSL https://get.pnpm.io/install.sh | bash -

# Install Bun (user-level)
RUN curl -fsSL https://bun.sh/install | bash

# Set environment variables
ENV PNPM_HOME="/home/node/.local/share/pnpm"
ENV BUN_INSTALL="/home/node/.bun"
ENV PATH="${BUN_INSTALL}/bin:${PNPM_HOME}:/home/node/.local/bin:${PATH}"

# Create directories with correct permissions
RUN mkdir -p \
    /home/node/.local/share/pnpm/store \
    /home/node/.config/claude \
    /home/node/.local/share/claude \
    /home/node/.npm-global \
    /home/node/.deno \
    && chown -R node:node /home/node

# Set Deno environment variables
ENV DENO_DIR="/home/node/.deno"

# Set working directory to workspace
WORKDIR /workspace

# Keep container running
CMD ["sleep", "infinity"]
