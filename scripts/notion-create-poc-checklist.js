#!/usr/bin/env node

/**
 * Create POC Evaluation Checklist in Notion
 */

const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_TOKEN || require('../.mcp.json').mcpServers.notion.env.NOTION_TOKEN
});

const rootPageId = '1e00a520-3786-8028-bddf-ea03101cc4b9'; // AI Admin root

async function createChecklist() {
  console.log('Creating POC Evaluation Checklist...');

  const response = await notion.pages.create({
    parent: { page_id: rootPageId },
    icon: { emoji: '✅' },
    properties: {
      title: [{ text: { content: 'POC Evaluation Checklist - Week 1' } }]
    },
    children: [
      {
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: [{ text: { content: 'Notion Workspace POC Evaluation' } }]
        }
      },
      {
        object: 'block',
        type: 'callout',
        callout: {
          icon: { emoji: '📅' },
          rich_text: [{
            text: {
              content: 'Evaluation Period: Week 1 (2025-11-15 to 2025-11-22) | Decision: End of Week'
            }
          }]
        }
      },
      {
        object: 'block',
        type: 'divider',
        divider: {}
      },
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ text: { content: '🎯 Success Criteria (ALL must pass)' } }]
        }
      },
      {
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: [{
            text: {
              content: 'Deployment logging: 100% reliable (5/5 deployments logged correctly)'
            }
          }],
          checked: false
        }
      },
      {
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: [{
            text: {
              content: 'Information discovery: <30 seconds to find current sprint status'
            }
          }],
          checked: false
        }
      },
      {
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: [{
            text: {
              content: 'Time savings: ≥30 min/week saved vs markdown-only'
            }
          }],
          checked: false
        }
      },
      {
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: [{
            text: {
              content: 'Data integrity: Zero data loss or corruption'
            }
          }],
          checked: false
        }
      },
      {
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: [{
            text: {
              content: 'Performance: <3 seconds to load Projects database'
            }
          }],
          checked: false
        }
      },
      {
        object: 'block',
        type: 'divider',
        divider: {}
      },
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ text: { content: '📊 Measurements & Testing' } }]
        }
      },
      {
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ text: { content: '1. Deployment Logging Test' } }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: {
              content: 'Trigger 5 test deployments using GitHub Actions workflow and verify all appear in Projects database.'
            }
          }]
        }
      },
      {
        object: 'block',
        type: 'code',
        code: {
          language: 'bash',
          rich_text: [{
            text: {
              content: '# Go to: https://github.com/[username]/ai_admin_v2/actions\n# Select "Log Deployment to Notion"\n# Run workflow 5 times with different params\n# Check Projects database for all 5 entries'
            }
          }]
        }
      },
      {
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ text: { content: '2. Information Discovery Test' } }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: {
              content: 'Task: Find current status of Client Reactivation Service v2 project (timed with Arbak)'
            }
          }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'Trial 1: ___ seconds' } }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'Trial 2: ___ seconds' } }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'Trial 3: ___ seconds' } }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'Average: ___ seconds (target: <30)' } }]
        }
      },
      {
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ text: { content: '3. Time Savings Tracking' } }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: {
              content: 'Track time for common tasks during the week:'
            }
          }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'Update task status: Notion vs Markdown' } }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'Check project progress: Notion vs Markdown' } }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'Share status with Arbak: Notion vs Markdown' } }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: {
              content: 'Total time saved this week: ___ minutes (target: ≥30)'
            }
          }]
        }
      },
      {
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ text: { content: '4. Data Integrity Check' } }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: {
              content: 'Daily comparison: markdown files vs Notion entries for any discrepancies'
            }
          }]
        }
      },
      {
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ text: { content: '5. Performance Test' } }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: {
              content: 'Use Chrome DevTools to measure Projects database load time (3 trials, 95th percentile)'
            }
          }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'Trial 1: ___ seconds' } }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'Trial 2: ___ seconds' } }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'Trial 3: ___ seconds' } }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: '95th percentile: ___ seconds (target: <3)' } }]
        }
      },
      {
        object: 'block',
        type: 'divider',
        divider: {}
      },
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ text: { content: '🚦 Go/No-Go Decision Framework' } }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: { content: 'Score: ___ / 5 criteria met' },
            annotations: { bold: true }
          }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{
            text: { content: 'GO (5/5): All criteria met → Proceed to Phase 1' },
            annotations: { bold: true }
          }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{
            text: { content: 'DEFER (3-4/5): Close to targets, extend POC to Week 2' }
          }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{
            text: { content: 'NO-GO (<3/5): Failed, document lessons, keep markdown-only' },
            annotations: { bold: true }
          }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: { content: 'Decision Date: 2025-11-22' },
            annotations: { italic: true }
          }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: { content: 'Final Decision: ____________' },
            annotations: { bold: true }
          }]
        }
      }
    ]
  });

  console.log('✅ POC Evaluation Checklist created!');
  console.log('URL:', response.url);
  console.log('Page ID:', response.id);

  return response;
}

createChecklist()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
