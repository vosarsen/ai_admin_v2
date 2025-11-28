#!/bin/bash

# Skip if environment variable is set
if [ -n "$SKIP_ERROR_REMINDER" ]; then
    exit 0
fi

# Export CLAUDE_PROJECT_DIR for child processes
export CLAUDE_PROJECT_DIR

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

cat | npx tsx error-handling-reminder.ts
