#!/bin/bash

echo "🔐 Starting SSH tunnel to Redis..."

# Kill any existing tunnel on port 6380
lsof -ti:6380 | xargs kill -9 2>/dev/null || true

# Start SSH tunnel in background
ssh -N -L 6380:localhost:6379 root@46.149.70.219 &
TUNNEL_PID=$!

echo "SSH tunnel started with PID: $TUNNEL_PID"

# Wait for tunnel to establish
sleep 2

# Update environment for MCP Redis
export REDIS_URL="redis://localhost:6380"
export REDIS_PASSWORD="70GB32AhHvMisfK8LtluTbtkWTnTj5jSrOdQj7d1QMg="

echo "🚀 Starting MCP Redis server..."
cd mcp-redis && node server.js

# Cleanup on exit
trap "kill $TUNNEL_PID 2>/dev/null" EXIT