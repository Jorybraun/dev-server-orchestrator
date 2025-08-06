#!/bin/bash

# Validation script for OpenVSCode Dev Server Orchestrator prerequisites
echo "🔧 Checking OpenVSCode Dev Server Orchestrator prerequisites..."

# Check if Docker is installed and running
if command -v docker &> /dev/null; then
    echo "✅ Docker is installed"
    
    if docker info &> /dev/null; then
        echo "✅ Docker daemon is running"
    else
        echo "❌ Docker daemon is not running. Please start Docker."
        exit 1
    fi
else
    echo "❌ Docker is not installed. Please install Docker."
    exit 1
fi

# Check if Docker Compose is available
if command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose is installed"
elif docker compose version &> /dev/null; then
    echo "✅ Docker Compose (plugin) is available"
else
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Check if Node.js is installed (for local development)
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js is installed ($NODE_VERSION)"
    
    # Check if version is 18 or higher
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1 | sed 's/v//')
    if [ "$MAJOR_VERSION" -ge 18 ]; then
        echo "✅ Node.js version is compatible (>=18)"
    else
        echo "⚠️  Node.js version should be 18 or higher for best compatibility"
    fi
else
    echo "⚠️  Node.js is not installed (only needed for local development)"
fi

# Check if npm is installed
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm is installed ($NPM_VERSION)"
else
    echo "⚠️  npm is not installed (only needed for local development)"
fi

# Check available disk space
AVAILABLE_SPACE=$(df -h . | tail -1 | awk '{print $4}')
echo "💾 Available disk space: $AVAILABLE_SPACE"

echo ""
echo "🎯 Prerequisites check complete!"
echo ""
echo "Quick start options:"
echo "  1. Development mode: docker-compose -f docker-compose.dev.yml up"
echo "  2. Production mode:  docker-compose up"
echo "  3. Local development: npm run install:all && npm run dev:backend (+ npm run dev:frontend in another terminal)"