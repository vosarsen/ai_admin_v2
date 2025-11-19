# iCloud Duplicate Files - Quick Reference Card

## Problem
347 files with " 2.md" suffix appeared due to iCloud Desktop & Documents sync conflicting with git operations.

## Root Cause
**iCloud Desktop & Documents sync is ACTIVE** and monitoring your repository, causing sync conflicts during fast git operations (branch switches, commits, merges).

---

## Quick Diagnosis (30 seconds)

```bash
# 1. Check if iCloud sync is the culprit
defaults read ~/Library/Preferences/MobileMeAccounts.plist | grep -A1 "CloudDesktop"

# If you see: status = active;
# → This is your problem!

# 2. Check active sync operations
brctl status | grep ai_admin_v2 | grep needs-sync

# Any output → iCloud is actively syncing your repo
```

---

## Quick Fix (2 minutes)

### Option A: Disable iCloud Sync (RECOMMENDED)

**GUI Method:**
1. System Settings → Apple ID → iCloud
2. Click "iCloud Drive" options
3. Uncheck "Desktop & Documents Folders"
4. Done!

**Why This Works:** Completely stops iCloud from monitoring your Documents folder.

---

### Option B: Exclude Just This Repo (5 minutes)

```bash
cd ~/Documents/GitHub/ai_admin_v2

# Automated
./scripts/prevent-icloud-duplicates.sh exclude

# Manual
mv ~/Documents/GitHub/ai_admin_v2 ~/Documents/GitHub/ai_admin_v2.nosync
ln -s ~/Documents/GitHub/ai_admin_v2.nosync ~/Documents/GitHub/ai_admin_v2
```

**Why This Works:** `.nosync` extension tells iCloud to ignore this folder.

---

## Cleanup Duplicates (1 minute)

```bash
cd ~/Documents/GitHub/ai_admin_v2

# Automated (safe, compares files before deletion)
./scripts/prevent-icloud-duplicates.sh cleanup

# Manual (nuclear option)
find . -type f -name "* 2.md" -delete
```

---

## Verify Fix Works (30 seconds)

```bash
# 1. No files should be syncing
brctl status | grep ai_admin_v2
# → Should return nothing

# 2. Test git operations
git checkout -b test-branch
touch test.md
git add test.md && git commit -m "test"
git checkout main
git branch -D test-branch

# 3. Check for new duplicates
find . -name "* 2.*" -type f
# → Should return nothing
```

---

## Prevention (One-Time Setup)

### Install Pre-Commit Hook

```bash
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
DUPLICATES=$(git diff --cached --name-only | grep -E " [0-9]+\.")
if [ -n "$DUPLICATES" ]; then
    echo "ERROR: iCloud duplicate files detected:"
    echo "$DUPLICATES"
    exit 1
fi
EOF

chmod +x .git/hooks/pre-commit
```

---

## Common Commands

```bash
# Check status
./scripts/prevent-icloud-duplicates.sh check

# Exclude from iCloud
./scripts/prevent-icloud-duplicates.sh exclude

# Cleanup duplicates
./scripts/prevent-icloud-duplicates.sh cleanup

# Monitor sync activity
./scripts/prevent-icloud-duplicates.sh monitor

# Find duplicates manually
find . -name "* 2.*"
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Duplicates keep appearing | Verify iCloud sync is disabled: `defaults read ~/Library/Preferences/MobileMeAccounts.plist \| grep CloudDesktop` |
| .nosync not working | Ensure exact name: `ls -la ai_admin_v2` should show `-> ai_admin_v2.nosync` |
| brctl not found | Use GUI check: System Settings → iCloud → iCloud Drive status |
| Script not executable | `chmod +x scripts/prevent-icloud-duplicates.sh` |

---

## When to Use Each Solution

| Situation | Solution |
|-----------|----------|
| **Developer with multiple git repos in Documents** | Disable Desktop & Documents sync (Option A) |
| **Need iCloud for some Documents files** | Use .nosync exclusion (Option B) |
| **Want clean separation** | Move repo to ~/Projects outside iCloud |
| **Advanced user** | Use xattr extended attributes |

---

## Why This Happens (Technical)

```
Git Operation          iCloud Drive          Result
═══════════════        ════════════          ══════
Checkout branch  →     Detects changes  →    Sync conflict
(< 1 second)           (5-30 seconds)        Creates " 2" files

Problem: Git is too fast for iCloud's sync algorithm
```

**The " 2" suffix is iCloud's conflict resolution mechanism** - when it can't reconcile changes between local and cloud versions, it preserves both by renaming the newer file.

---

## Recommended Action for Your Case

```bash
# 1. Disable iCloud Desktop sync (GUI)
#    System Settings → Apple ID → iCloud → Uncheck "Desktop & Documents"

# 2. Clean up existing duplicates
cd ~/Documents/GitHub/ai_admin_v2
./scripts/prevent-icloud-duplicates.sh cleanup

# 3. Commit cleanup
git add -A
git commit -m "chore: Remove iCloud duplicate files"

# 4. Verify prevention works
./scripts/prevent-icloud-duplicates.sh check

# Total time: ~5 minutes
```

---

## Documentation

Full guide: `/Users/vosarsen/Documents/GitHub/ai_admin_v2/docs/ICLOUD_DUPLICATE_FILES_GUIDE.md`
Script: `/Users/vosarsen/Documents/GitHub/ai_admin_v2/scripts/prevent-icloud-duplicates.sh`

---

**Last Updated:** 2025-11-12
