#!/bin/bash

# MCP Environment Variables Setup
# Based on .env file values

echo "Setting up MCP environment variables..."

# Redis
export REDIS_URL="redis://127.0.0.1:6379"

# WhatsApp/AI Admin
export AI_ADMIN_API_URL="http://localhost:3000"
export SECRET_KEY="sk_venom_webhook_3553"

# YClients
export YCLIENTS_API_KEY="cfjbs9dpuseefh8ed5cp"
export YCLIENTS_USER_TOKEN="16e0dffa0d71350dcb83381e03e7af29"

# Supabase (already set, but including for completeness)
export SUPABASE_URL="https://yazteodihdglhoxgqunp.supabase.co"
export SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhenRlb2RpaGRnbGhveGdxdW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyOTU0NzcsImV4cCI6MjA1OTg3MTQ3N30.YWm7hXpWgbmQjN_s0CH_SsMcC7DFi-ZPNahY4rKl7a8"

echo "Environment variables set!"
echo ""
echo "To make these permanent, add the following to your ~/.zshrc or ~/.bash_profile:"
echo ""
echo "# MCP Environment Variables"
echo "export REDIS_URL=\"redis://127.0.0.1:6379\""
echo "export AI_ADMIN_API_URL=\"http://localhost:3000\""
echo "export SECRET_KEY=\"sk_venom_webhook_3553\""
echo "export YCLIENTS_API_KEY=\"cfjbs9dpuseefh8ed5cp\""
echo "export YCLIENTS_USER_TOKEN=\"16e0dffa0d71350dcb83381e03e7af29\""
echo ""
echo "Then run: source ~/.zshrc"
echo ""
echo "After setting the variables, restart Claude Code for MCP servers to activate."