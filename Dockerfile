# Use Node.js 20.18.0
FROM node:20.18.0-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]
