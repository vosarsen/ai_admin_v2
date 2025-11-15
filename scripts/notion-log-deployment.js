#!/usr/bin/env node

/**
 * Notion Deployment Logger
 *
 * Logs deployment events to Notion Projects database
 * Called from GitHub Actions or manually after deployments
 *
 * Usage:
 *   node scripts/notion-log-deployment.js \
 *     --commit=abc1234 \
 *     --status=Success \
 *     --duration=75 \
 *     --services="ai-admin-worker-v2,ai-admin-api-v2" \
 *     --notes="Phase 5: Production cutover complete"
 */

const { Client } = require('@notionhq/client');

// Parse command-line arguments
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const [key, value] = arg.split('=');
    const cleanKey = key.replace('--', '');
    args[cleanKey] = value;
  });
  return args;
}

// Retry with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function logDeployment({ commit, status, duration, services, notes = '' }) {
  // Validate required args
  if (!commit || !status) {
    throw new Error('Missing required arguments: --commit and --status are required');
  }

  // Initialize Notion client
  const notion = new Client({
    auth: process.env.NOTION_TOKEN || require('../.mcp.json').mcpServers.notion.env.NOTION_TOKEN
  });

  const projectsDbId = '2ac0a520-3786-819a-b0ab-c7758efab9fb';

  // Prepare deployment entry
  const deploymentName = `Deploy ${commit.slice(0, 7)} - ${status}`;
  const deploymentDate = new Date().toISOString();

  console.log(`Logging deployment to Notion: ${deploymentName}`);

  // Create page in Projects database
  const createPage = async () => {
    const properties = {
      Name: {
        title: [{ text: { content: deploymentName } }]
      },
      Status: {
        select: { name: status === 'Success' ? 'Deployed' : 'Active' }
      },
      Phase: {
        select: { name: 'Phase 0' } // POC deployments
      },
      Component: {
        multi_select: services ? services.split(',').map(s => ({ name: s.trim() })) : []
      },
      'Start Date': {
        date: { start: deploymentDate }
      }
    };

    // Build page content
    const children = [];

    // Add deployment details
    children.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ text: { content: 'Deployment Details' } }]
      }
    });

    children.push({
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [{ text: { content: `Commit: ${commit}` } }]
      }
    });

    children.push({
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [{ text: { content: `Status: ${status}` } }]
      }
    });

    if (duration) {
      children.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: `Duration: ${duration} minutes` } }]
        }
      });
    }

    if (services) {
      children.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: `Services: ${services}` } }]
        }
      });
    }

    if (notes) {
      children.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: '' } }]
        }
      });

      children.push({
        object: 'block',
        type: 'callout',
        callout: {
          icon: { emoji: '📝' },
          rich_text: [{ text: { content: notes } }]
        }
      });
    }

    return await notion.pages.create({
      parent: { database_id: projectsDbId },
      properties,
      children
    });
  };

  try {
    const page = await retryWithBackoff(createPage);
    console.log(`✅ Deployment logged successfully: ${page.url}`);
    return page;
  } catch (error) {
    console.error('❌ Failed to log deployment:', error.message);

    // Don't fail CI/CD pipeline on Notion errors
    console.log('⚠️  Continuing despite Notion error (deployment logging is non-critical)');
    process.exit(0); // Exit successfully even if Notion fails
  }
}

// Main execution
if (require.main === module) {
  const args = parseArgs();

  logDeployment(args)
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { logDeployment };
