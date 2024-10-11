# Use an official Node.js runtime as a parent image
FROM node:20-slim

# Install Chromium for Puppeteer
RUN apt-get update && apt-get install -y chromium

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy the rest of the application code
COPY . .

# Copy package.json and package-lock.json files
COPY package*.json ./

# Install dependencies
RUN yarn run clean:install:build

# Set environment variables (optional, for Node.js)
ENV NODE_ENV production

# Expose port (for example, 3000)
EXPOSE 3001

# Add the --no-sandbox flag to Chromium for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_FLAGS="--no-sandbox"

# Command to start your application
CMD ["yarn", "start"]
