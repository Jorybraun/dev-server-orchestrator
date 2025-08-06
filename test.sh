#!/bin/bash

# Simple test script to validate the OpenVSCode Dev Server Orchestrator
echo "🧪 Testing OpenVSCode Dev Server Orchestrator..."

# Start backend
echo "📡 Starting backend server..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Test health endpoint
echo "🔍 Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:3001/health)
if [[ $HEALTH_RESPONSE == *"ok"* ]]; then
    echo "✅ Health endpoint working"
else
    echo "❌ Health endpoint failed"
    kill $BACKEND_PID
    exit 1
fi

# Test list sessions endpoint
echo "🔍 Testing list sessions endpoint..."
SESSIONS_RESPONSE=$(curl -s http://localhost:3001/api/dev-server)
if [[ $SESSIONS_RESPONSE == *"sessions"* ]]; then
    echo "✅ List sessions endpoint working"
else
    echo "❌ List sessions endpoint failed"
    kill $BACKEND_PID
    exit 1
fi

# Test frontend build
echo "🔍 Testing frontend build..."
cd frontend
if npm run build > /dev/null 2>&1; then
    echo "✅ Frontend builds successfully"
else
    echo "❌ Frontend build failed"
    kill $BACKEND_PID
    exit 1
fi
cd ..

# Clean up
echo "🧹 Cleaning up..."
kill $BACKEND_PID

echo "🎉 All tests passed! The OpenVSCode Dev Server Orchestrator is ready!"
echo ""
echo "To start the application:"
echo "  Development: docker-compose -f docker-compose.dev.yml up"
echo "  Production:  docker-compose up"
echo ""
echo "Then visit: http://localhost:3000"