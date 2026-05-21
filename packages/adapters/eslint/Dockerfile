FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1001 -S adapter && \
    adduser -u 1001 -S adapter -G adapter

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy adapter code
COPY adapter.js ./

# Set ownership
RUN chown -R adapter:adapter /app

# Switch to non-root user
USER adapter

# Set resource limits via Node
ENV NODE_OPTIONS="--max-old-space-size=512"

# No ENTRYPOINT - let the command be specified at runtime