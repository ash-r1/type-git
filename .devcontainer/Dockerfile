FROM node:20-bullseye

# Install basic tools
RUN apt-get update && apt-get install -y \
    git \
    git-lfs \
    curl \
    wget \
    sudo \
    vim \
    && rm -rf /var/lib/apt/lists/*

# Setup git-lfs
RUN git lfs install

# Setup node user with sudo access
RUN usermod -aG sudo node && \
    echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Switch to node user
USER node
WORKDIR /home/node

# Install pnpm globally as node user with explicit shell
ENV SHELL=/bin/bash
RUN curl -fsSL https://get.pnpm.io/install.sh | bash -

# Set environment variables for pnpm
ENV PNPM_HOME="/home/node/.local/share/pnpm"
ENV PATH="${PNPM_HOME}:/home/node/.local/bin:${PATH}"

# Create directories with correct permissions
RUN mkdir -p \
    /home/node/.local/share/pnpm/store \
    /home/node/.config/claude \
    /home/node/.local/share/claude \
    /home/node/.npm-global \
    && chown -R node:node /home/node

# Set working directory to workspace
WORKDIR /workspace

# Keep container running
CMD ["sleep", "infinity"]
