#!/usr/bin/env node
/**
 * GlitchTip API Example
 *
 * Quick test of GlitchTip API access
 *
 * Setup:
 * 1. Get API token: http://localhost:9090 → Settings → Auth Tokens
 * 2. Set token: export GLITCHTIP_TOKEN=your-token
 * 3. Run: node scripts/glitchtip-api-example.js
 */

const axios = require('axios');

// Configuration
const GLITCHTIP_URL = 'http://localhost:8080';
const API_TOKEN = process.env.GLITCHTIP_TOKEN;

if (!API_TOKEN) {
  console.error('❌ GLITCHTIP_TOKEN not set');
  console.error('Get token from: http://localhost:9090 → Settings → Auth Tokens');
  process.exit(1);
}

// API Client
const api = axios.create({
  baseURL: `${GLITCHTIP_URL}/api/0`,
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Example 1: Get organizations
async function getOrganizations() {
  console.log('\n📊 Fetching organizations...');
  const { data } = await api.get('/organizations/');
  console.log(`Found ${data.length} organization(s)`);
  data.forEach(org => {
    console.log(`  - ${org.name} (slug: ${org.slug})`);
  });
  return data[0]; // Return first org
}

// Example 2: Get recent issues
async function getRecentIssues(orgSlug) {
  console.log(`\n🔍 Fetching recent issues for ${orgSlug}...`);

  const { data } = await api.get(`/organizations/${orgSlug}/issues/`, {
    params: {
      query: 'is:unresolved',
      limit: 5,
      sort: '-lastSeen'
    }
  });

  console.log(`Found ${data.length} unresolved issue(s)`);
  data.forEach((issue, i) => {
    console.log(`\n${i + 1}. Issue #${issue.id}: ${issue.title}`);
    console.log(`   Level: ${issue.level}`);
    console.log(`   Count: ${issue.count}`);
    console.log(`   Last seen: ${new Date(issue.lastSeen).toLocaleString()}`);
    console.log(`   URL: ${issue.permalink}`);

    // Show tags
    if (issue.tags && issue.tags.length > 0) {
      const tags = issue.tags.map(t => `${t.key}:${t.value}`).join(', ');
      console.log(`   Tags: ${tags}`);
    }
  });

  return data;
}

// Example 3: Get error statistics
async function getStats(orgSlug) {
  console.log(`\n📈 Fetching error statistics for ${orgSlug}...`);

  const since = Math.floor(Date.now() / 1000) - (24 * 60 * 60); // Last 24h

  const { data } = await api.get(`/organizations/${orgSlug}/stats-summary/`, {
    params: { since }
  });

  console.log(`\nStats (last 24h):`);
  data.forEach(project => {
    console.log(`  ${project.name}: ${project.stats.sum} errors`);
  });

  return data;
}

// Example 4: Add comment to issue
async function addComment(orgSlug, issueId, message) {
  console.log(`\n💬 Adding comment to issue #${issueId}...`);

  try {
    const { data } = await api.post(
      `/organizations/${orgSlug}/issues/${issueId}/comments/`,
      { data: { text: message } }
    );

    console.log(`✅ Comment added successfully`);
    return data;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`⚠️  Issue #${issueId} not found or no permissions`);
    } else {
      throw error;
    }
  }
}

// Example 5: Resolve issue
async function resolveIssue(orgSlug, issueId) {
  console.log(`\n✅ Resolving issue #${issueId}...`);

  try {
    const { data } = await api.put(
      `/organizations/${orgSlug}/issues/${issueId}/`,
      { status: 'resolved' }
    );

    console.log(`✅ Issue resolved successfully`);
    return data;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`⚠️  Issue #${issueId} not found or no permissions`);
    } else {
      throw error;
    }
  }
}

// Example 6: Search issues by query
async function searchIssues(orgSlug, query) {
  console.log(`\n🔎 Searching issues: "${query}"`);

  const { data } = await api.get(`/organizations/${orgSlug}/issues/`, {
    params: {
      query,
      limit: 10,
      sort: '-count'
    }
  });

  console.log(`Found ${data.length} issue(s)`);
  data.forEach((issue, i) => {
    console.log(`  ${i + 1}. #${issue.id}: ${issue.title} (${issue.count}x)`);
  });

  return data;
}

// Main
async function main() {
  console.log('🚀 GlitchTip API Example\n');
  console.log(`URL: ${GLITCHTIP_URL}`);
  console.log(`Token: ${API_TOKEN.substring(0, 10)}...`);

  try {
    // 1. Get organizations
    const org = await getOrganizations();

    if (!org) {
      console.error('\n❌ No organizations found');
      process.exit(1);
    }

    // 2. Get recent issues
    const issues = await getRecentIssues(org.slug);

    // 3. Get statistics
    await getStats(org.slug);

    // 4. Search examples
    console.log('\n\n📋 Search Examples:');

    await searchIssues(org.slug, 'is:unresolved level:error');
    await searchIssues(org.slug, 'is:unresolved age:-24h');
    await searchIssues(org.slug, 'component:database');

    // 5. Add comment (only if issues exist)
    if (issues.length > 0) {
      console.log('\n\n💡 You can add comments:');
      console.log(`await addComment('${org.slug}', ${issues[0].id}, 'Investigation notes...')`);

      console.log('\n💡 You can resolve issues:');
      console.log(`await resolveIssue('${org.slug}', ${issues[0].id})`);
    }

    console.log('\n\n✅ All examples completed successfully!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }

    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

// Export for use in other scripts
module.exports = {
  getOrganizations,
  getRecentIssues,
  getStats,
  addComment,
  resolveIssue,
  searchIssues
};
