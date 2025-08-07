FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache git

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create repos directory
RUN mkdir -p repos

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]