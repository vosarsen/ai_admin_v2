#!/bin/bash

# iCloud Duplicates Prevention Script
# Helps manage iCloud sync issues with git repositories

set -e

REPO_PATH="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

function check_status() {
    print_header "iCloud Sync Status Check"
    
    # Check if Desktop & Documents sync is enabled
    echo -e "${YELLOW}Checking iCloud Desktop & Documents sync...${NC}"
    if defaults read ~/Library/Preferences/MobileMeAccounts.plist 2>/dev/null | grep -q "CloudDesktop.*active"; then
        echo -e "${RED}✗ Desktop & Documents sync is ENABLED${NC}"
        echo -e "  This can cause duplicate files in git repos"
    else
        echo -e "${GREEN}✓ Desktop & Documents sync is disabled${NC}"
    fi
    
    # Check if repo is already excluded
    if [[ "$REPO_PATH" == *.nosync* ]] || [[ "$REPO_PATH" == *.nocloud* ]]; then
        echo -e "${GREEN}✓ Repository is excluded from iCloud${NC}"
    else
        echo -e "${YELLOW}⚠ Repository is NOT excluded${NC}"
    fi
    
    # Check for active sync operations
    echo -e "\n${YELLOW}Checking active sync operations...${NC}"
    if command -v brctl &> /dev/null; then
        SYNC_STATUS=$(brctl status 2>/dev/null | grep -i "$(basename "$REPO_PATH")" || echo "")
        if [ -z "$SYNC_STATUS" ]; then
            echo -e "${GREEN}✓ No active sync operations${NC}"
        else
            echo -e "${YELLOW}⚠ Active sync operations detected:${NC}"
            echo "$SYNC_STATUS"
        fi
    else
        echo -e "${YELLOW}⚠ brctl not available (optional tool)${NC}"
    fi
    
    # Count duplicate files
    echo -e "\n${YELLOW}Checking for duplicate files...${NC}"
    DUPLICATE_COUNT=$(find "$REPO_PATH" -name "* 2.*" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$DUPLICATE_COUNT" -eq 0 ]; then
        echo -e "${GREEN}✓ No duplicate files found${NC}"
    else
        echo -e "${RED}✗ Found $DUPLICATE_COUNT duplicate files${NC}"
        echo -e "  Run: $0 cleanup"
    fi
}

function exclude_from_icloud() {
    print_header "Exclude Repository from iCloud"
    
    if [[ "$REPO_PATH" == *.nosync* ]]; then
        echo -e "${GREEN}Repository is already excluded from iCloud${NC}"
        return
    fi
    
    PARENT_DIR=$(dirname "$REPO_PATH")
    REPO_NAME=$(basename "$REPO_PATH")
    NEW_PATH="$PARENT_DIR/${REPO_NAME}.nosync"
    
    echo -e "${YELLOW}This will:${NC}"
    echo "  1. Rename: $REPO_PATH"
    echo "  2. To:     $NEW_PATH"
    echo "  3. Create symlink at original location"
    echo ""
    read -p "Continue? (y/n) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        return
    fi
    
    # Rename directory
    echo -e "${YELLOW}Renaming directory...${NC}"
    mv "$REPO_PATH" "$NEW_PATH"
    
    # Create symlink
    echo -e "${YELLOW}Creating symlink...${NC}"
    ln -s "$NEW_PATH" "$REPO_PATH"
    
    echo -e "${GREEN}✓ Repository excluded from iCloud${NC}"
    echo -e "  New location: $NEW_PATH"
    echo -e "  Symlink:      $REPO_PATH"
}

function cleanup_duplicates() {
    print_header "Clean Up Duplicate Files"
    
    DUPLICATES=$(find "$REPO_PATH" -name "* 2.*" 2>/dev/null)
    DUPLICATE_COUNT=$(echo "$DUPLICATES" | grep -v "^$" | wc -l | tr -d ' ')
    
    if [ "$DUPLICATE_COUNT" -eq 0 ]; then
        echo -e "${GREEN}No duplicate files found${NC}"
        return
    fi
    
    echo -e "${YELLOW}Found $DUPLICATE_COUNT duplicate files${NC}"
    echo ""
    echo "This will compare each duplicate with its original and:"
    echo "  - Remove if content is identical"
    echo "  - Keep if content differs (manual review needed)"
    echo ""
    read -p "Continue? (y/n) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        return
    fi
    
    REMOVED=0
    KEPT=0
    
    while IFS= read -r duplicate; do
        [ -z "$duplicate" ] && continue
        
        # Get original filename
        original="${duplicate% 2.*}.${duplicate##*.}"
        
        if [ -f "$original" ]; then
            # Compare files
            if cmp -s "$duplicate" "$original"; then
                echo -e "${GREEN}✓ Removing identical:${NC} $(basename "$duplicate")"
                rm "$duplicate"
                ((REMOVED++))
            else
                echo -e "${YELLOW}⚠ Kept (differs):${NC} $(basename "$duplicate")"
                ((KEPT++))
            fi
        else
            echo -e "${RED}✗ Original not found:${NC} $(basename "$duplicate")"
            ((KEPT++))
        fi
    done <<< "$DUPLICATES"
    
    echo ""
    echo -e "${GREEN}Cleanup complete:${NC}"
    echo "  Removed: $REMOVED files"
    echo "  Kept:    $KEPT files (manual review needed)"
}

function monitor_sync() {
    print_header "Monitor iCloud Sync Activity"
    
    if ! command -v brctl &> /dev/null; then
        echo -e "${RED}Error: brctl command not found${NC}"
        echo "This feature requires macOS 10.12+ with iCloud Drive enabled"
        return 1
    fi
    
    echo -e "${YELLOW}Monitoring sync activity...${NC}"
    echo "Press Ctrl+C to stop"
    echo ""
    
    brctl monitor com.apple.CloudDocs | grep --line-buffered "$(basename "$REPO_PATH")"
}

# Main script
case "${1:-}" in
    check)
        check_status
        ;;
    exclude)
        exclude_from_icloud
        ;;
    cleanup)
        cleanup_duplicates
        ;;
    monitor)
        monitor_sync
        ;;
    *)
        echo "iCloud Duplicates Prevention Script"
        echo ""
        echo "Usage: $0 {check|exclude|cleanup|monitor}"
        echo ""
        echo "Commands:"
        echo "  check    - Check iCloud sync status and count duplicates"
        echo "  exclude  - Exclude repository from iCloud sync (.nosync)"
        echo "  cleanup  - Remove duplicate files (safe comparison)"
        echo "  monitor  - Monitor real-time sync activity"
        echo ""
        exit 1
        ;;
esac
