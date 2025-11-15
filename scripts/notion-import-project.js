#!/usr/bin/env node

/**
 * Import Client Reactivation Service v2 to Notion Projects database
 */

const { Client } = require('@notionhq/client');
const path = require('path');

const notion = new Client({
  auth: process.env.NOTION_TOKEN || require('../.mcp.json').mcpServers.notion.env.NOTION_TOKEN
});

const projectsDbId = '2ac0a520-3786-819a-b0ab-c7758efab9fb';

async function importProject() {
  console.log('Creating Client Reactivation Service v2 project in Notion...');

  const response = await notion.pages.create({
    parent: { database_id: projectsDbId },
    icon: { emoji: '🔄' },
    properties: {
      Name: {
        title: [{ text: { content: 'Client Reactivation Service v2' } }]
      },
      Status: {
        select: { name: 'Active' }
      },
      Phase: {
        select: { name: 'Phase 0' }
      },
      Component: {
        multi_select: [
          { name: 'WhatsApp' },
          { name: 'Database' },
          { name: 'AI' }
        ]
      },
      'Start Date': {
        date: { start: '2025-11-12' }
      }
    },
    children: [
      {
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: [{ text: { content: 'Client Reactivation Service v2' } }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: {
              content: 'Build an intelligent, AI-powered client reactivation system that automatically identifies inactive clients, sends personalized WhatsApp messages, and seamlessly integrates with AI Admin v2\'s Redis context system to handle responses and track conversions end-to-end.'
            }
          }]
        }
      },
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ text: { content: 'Key Features' } }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'Complete Timeweb PostgreSQL integration' } }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'Repository pattern implemented' } }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'Redis context integration for tracking responses' } }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: '3-level waterfall interval selection' } }]
        }
      },
      {
        object: 'block',
        type: 'callout',
        callout: {
          icon: { emoji: '📋' },
          rich_text: [{
            text: {
              content: 'Status: Ready for Implementation | Timeline: 4 days | Risk: Low'
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
          rich_text: [{ text: { content: 'Project Files' } }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: {
              content: 'dev/active/client-reactivation-service-v2/'
            },
            annotations: { code: true }
          }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'client-reactivation-service-v2-plan.md' } }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'client-reactivation-service-v2-context.md' } }]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'client-reactivation-service-v2-tasks.md' } }]
        }
      }
    ]
  });

  console.log('✅ Project created successfully!');
  console.log('URL:', response.url);
  console.log('Page ID:', response.id);

  return response;
}

importProject()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
