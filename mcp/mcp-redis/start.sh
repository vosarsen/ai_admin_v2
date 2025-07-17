#!/bin/bash

# Set Redis connection to use SSH tunnel
export REDIS_URL="redis://localhost:6380"
export REDIS_PASSWORD="70GB32AhHvMisfK8LtluTbtkWTnTj5jSrOdQj7d1QMg="

# Start the MCP server
exec node server.js