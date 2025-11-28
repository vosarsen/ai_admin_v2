#!/bin/bash
set -e

# Export CLAUDE_PROJECT_DIR for child processes
export CLAUDE_PROJECT_DIR

cd "$CLAUDE_PROJECT_DIR/.claude/hooks"
cat | npx tsx skill-activation-prompt.ts
