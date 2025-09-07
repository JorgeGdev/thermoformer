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

# Expose port (Railway will set the PORT env var)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
