# GitHub Secrets Setup for Notion Integration

## Required Secrets

Add the following secret to your GitHub repository:

### NOTION_TOKEN

**Value:** `ntn_u277035200626fQchaKwNREsPvVaV02f8Qz0yPTrdZTgJl`

## How to Add

1. Go to: https://github.com/[your-username]/ai_admin_v2/settings/secrets/actions
2. Click **"New repository secret"**
3. Name: `NOTION_TOKEN`
4. Secret: Paste the token value above
5. Click **"Add secret"**

## Testing

After adding the secret, you can test the workflow:

1. Go to: https://github.com/[your-username]/ai_admin_v2/actions
2. Select **"Log Deployment to Notion"** workflow
3. Click **"Run workflow"**
4. Fill in the form:
   - Commit: `test-deploy-123`
   - Status: `Success`
   - Duration: `5`
   - Services: `ai-admin-worker-v2`
   - Notes: `Test deployment from GitHub Actions`
5. Click **"Run workflow"**
6. Wait for completion (~30 seconds)
7. Check Notion Projects database for new entry

## Verification

✅ Secret added successfully when workflow runs without authentication errors
✅ Deployment appears in Notion: https://www.notion.so/2ac0a520-3786-819a-b0ab-c7758efab9fb

## Database IDs (Reference)

- Projects DB: `2ac0a520-3786-819a-b0ab-c7758efab9fb`
- Tasks DB: `2ac0a520-3786-81ed-8d10-ef3bc2974e3a`
- Knowledge Base DB: `2ac0a520-3786-81b6-8430-d98b279dc5f2`
