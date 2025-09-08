# Use Node.js 20.18.0
FROM node:20.18.0-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --production=false

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm ci --production=true && npm cache clean --force

# Create a simple start script
RUN echo '#!/bin/sh\nexport PORT=${PORT:-4321}\nexport HOST=0.0.0.0\necho "Starting on $HOST:$PORT"\nnode ./dist/server/entry.mjs' > /app/start.sh && chmod +x /app/start.sh

# Expose port 4321 (Railway will map it to their port)
EXPOSE 4321

# Start the application
CMD ["/app/start.sh"]
