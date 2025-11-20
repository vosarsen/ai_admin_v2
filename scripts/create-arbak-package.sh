#!/bin/bash

# Script to create Claude Code infrastructure package for Arbak
# Usage: ./scripts/create-arbak-package.sh

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Creating Claude Code Infrastructure Package for Arbak"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Configuration
PACKAGE_NAME="claude-code-infrastructure-for-arbak"
PACKAGE_DIR="${PACKAGE_NAME}"
ARCHIVE_NAME="${PACKAGE_NAME}.tar.gz"

# Clean up any previous package
if [ -d "$PACKAGE_DIR" ]; then
    echo "🧹 Cleaning up previous package..."
    rm -rf "$PACKAGE_DIR"
fi

if [ -f "$ARCHIVE_NAME" ]; then
    echo "🧹 Removing old archive..."
    rm "$ARCHIVE_NAME"
fi

# Create package directory structure
echo "📁 Creating package structure..."
mkdir -p "$PACKAGE_DIR/docs"

# Copy infrastructure
echo "📋 Copying .claude infrastructure..."
cp -r .claude "$PACKAGE_DIR/"

# Copy documentation
echo "📚 Copying documentation..."
cp docs/99-meta/ARBAK_PACKAGE_README.md "$PACKAGE_DIR/README.md"
cp docs/99-meta/ARBAK_QUICK_START.md "$PACKAGE_DIR/docs/"
cp docs/99-meta/ARBAK_INTEGRATION_GUIDE.md "$PACKAGE_DIR/docs/"
cp docs/99-meta/ARBAK_CUSTOMIZATION_CHECKLIST.md "$PACKAGE_DIR/docs/"
cp docs/99-meta/Reddit-Post.md "$PACKAGE_DIR/docs/"

# Optional: Copy transfer instructions (for your reference)
cp docs/99-meta/ARBAK_TRANSFER_INSTRUCTIONS.md "$PACKAGE_DIR/docs/" 2>/dev/null || true

# Create .gitignore if creating a git repo
cat > "$PACKAGE_DIR/.gitignore" << 'EOF'
.DS_Store
.claude/hooks/node_modules/
EOF

# Security check
echo ""
echo "🔒 Security check: Scanning for sensitive data..."
SENSITIVE_FOUND=false

if grep -r "GEMINI_API_KEY" "$PACKAGE_DIR/.claude/" 2>/dev/null; then
    echo "⚠️  WARNING: Found GEMINI_API_KEY reference"
    SENSITIVE_FOUND=true
fi

if grep -r "SUPABASE" "$PACKAGE_DIR/.claude/" 2>/dev/null; then
    echo "⚠️  WARNING: Found SUPABASE reference"
    SENSITIVE_FOUND=true
fi

if grep -r "962302" "$PACKAGE_DIR/.claude/" 2>/dev/null; then
    echo "⚠️  WARNING: Found company ID (962302)"
    SENSITIVE_FOUND=true
fi

if [ "$SENSITIVE_FOUND" = false ]; then
    echo "✅ No sensitive data found"
fi

# Verify package contents
echo ""
echo "✅ Verifying package contents..."

# Check infrastructure
if [ ! -d "$PACKAGE_DIR/.claude/skills" ]; then
    echo "❌ ERROR: .claude/skills not found!"
    exit 1
fi

if [ ! -d "$PACKAGE_DIR/.claude/hooks" ]; then
    echo "❌ ERROR: .claude/hooks not found!"
    exit 1
fi

if [ ! -d "$PACKAGE_DIR/.claude/agents" ]; then
    echo "❌ ERROR: .claude/agents not found!"
    exit 1
fi

if [ ! -f "$PACKAGE_DIR/.claude/settings.json" ]; then
    echo "❌ ERROR: .claude/settings.json not found!"
    exit 1
fi

# Check documentation
if [ ! -f "$PACKAGE_DIR/README.md" ]; then
    echo "❌ ERROR: README.md not found!"
    exit 1
fi

if [ ! -f "$PACKAGE_DIR/docs/ARBAK_QUICK_START.md" ]; then
    echo "❌ ERROR: Quick Start guide not found!"
    exit 1
fi

echo "✅ All required files present"

# Count files
SKILL_COUNT=$(find "$PACKAGE_DIR/.claude/skills" -name "SKILL.md" | wc -l | tr -d ' ')
HOOK_COUNT=$(find "$PACKAGE_DIR/.claude/hooks" -name "*.sh" | wc -l | tr -d ' ')
AGENT_COUNT=$(find "$PACKAGE_DIR/.claude/agents" -name "*.md" | wc -l | tr -d ' ')
COMMAND_COUNT=$(find "$PACKAGE_DIR/.claude/commands" -name "*.md" | wc -l | tr -d ' ')

echo ""
echo "📊 Package summary:"
echo "   - Skills: $SKILL_COUNT"
echo "   - Hooks: $HOOK_COUNT"
echo "   - Agents: $AGENT_COUNT"
echo "   - Commands: $COMMAND_COUNT"

# Create archive
echo ""
echo "📦 Creating archive..."
tar -czf "$ARCHIVE_NAME" "$PACKAGE_DIR"

# Get archive size
ARCHIVE_SIZE=$(ls -lh "$ARCHIVE_NAME" | awk '{print $5}')

echo "✅ Archive created: $ARCHIVE_NAME ($ARCHIVE_SIZE)"

# Cleanup package directory
echo ""
echo "🧹 Cleaning up temporary directory..."
rm -rf "$PACKAGE_DIR"

# Final summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Package ready for Arbak!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📦 Archive: $ARCHIVE_NAME ($ARCHIVE_SIZE)"
echo ""
echo "📧 Next steps:"
echo "   1. Send $ARCHIVE_NAME to Arbak"
echo "   2. Include message from docs/99-meta/ARBAK_TRANSFER_INSTRUCTIONS.md"
echo "   3. Offer to help with setup"
echo ""
echo "📚 Arbak should:"
echo "   1. Extract archive"
echo "   2. Read README.md"
echo "   3. Follow docs/ARBAK_QUICK_START.md"
echo ""
echo "Good luck! 🚀"
echo ""
