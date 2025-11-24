#!/usr/bin/env node
/**
 * GlitchTip API Client - Smoke Tests
 *
 * Tests basic functionality of the GlitchTipAPI class
 *
 * Usage:
 *   export GLITCHTIP_TOKEN=your-token
 *   node scripts/lib/glitchtip-api.test.js
 */

const GlitchTipAPI = require('./glitchtip-api');

// Configuration
const GLITCHTIP_URL = process.env.GLITCHTIP_URL || 'http://localhost:8080';
const API_TOKEN = process.env.GLITCHTIP_TOKEN;

if (!API_TOKEN) {
  console.error('❌ GLITCHTIP_TOKEN not set');
  console.error('Export token: export GLITCHTIP_TOKEN=your-token');
  process.exit(1);
}

// Test runner
async function runTests() {
  console.log('🧪 GlitchTip API Client - Smoke Tests\n');
  console.log(`URL: ${GLITCHTIP_URL}`);
  console.log(`Token: ${API_TOKEN.substring(0, 10)}...\n`);

  const client = new GlitchTipAPI(GLITCHTIP_URL, API_TOKEN);
  let testsPassed = 0;
  let testsFailed = 0;
  let orgSlug = null;

  // Test 1: Get organizations
  try {
    console.log('Test 1: getOrganizations()');
    const orgs = await client.getOrganizations();
    if (orgs && orgs.length > 0) {
      console.log(`✅ PASS - Found ${orgs.length} organization(s)`);
      console.log(`   First org: ${orgs[0].name} (${orgs[0].slug})`);
      orgSlug = orgs[0].slug;
      testsPassed++;
    } else {
      console.log('❌ FAIL - No organizations found');
      testsFailed++;
      process.exit(1);
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Test 2: Get issues (last 24h)
  try {
    console.log('Test 2: getIssues() - last 24h');
    const issues = await client.getIssues(orgSlug, { limit: 5, statsPeriod: '24h' });
    console.log(`✅ PASS - Found ${issues.length} issue(s)`);
    if (issues.length > 0) {
      console.log(`   First issue: "${issues[0].title}" (ID: ${issues[0].id})`);
    }
    testsPassed++;
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Test 3: Search unresolved issues
  try {
    console.log('Test 3: searchIssues() - unresolved');
    const unresolvedIssues = await client.searchIssues(orgSlug, 'is:unresolved', 5);
    console.log(`✅ PASS - Found ${unresolvedIssues.length} unresolved issue(s)`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Test 4: Get issue details (if issues exist)
  try {
    console.log('Test 4: getIssue() - issue details');
    const issues = await client.getIssues(orgSlug, { limit: 1 });
    if (issues.length > 0) {
      const issueId = issues[0].id;
      const issue = await client.getIssue(orgSlug, issueId);
      console.log(`✅ PASS - Got details for issue ${issueId}`);
      console.log(`   Title: "${issue.title}"`);
      console.log(`   Count: ${issue.count}, Level: ${issue.level}, Status: ${issue.status}`);
      testsPassed++;
    } else {
      console.log('⏭️  SKIP - No issues to test with');
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Test 5: Get projects
  try {
    console.log('Test 5: getProjects()');
    const projects = await client.getProjects(orgSlug);
    console.log(`✅ PASS - Found ${projects.length} project(s)`);
    if (projects.length > 0) {
      console.log(`   First project: ${projects[0].name} (${projects[0].slug})`);
    }
    testsPassed++;
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Test 6: Get stats (last 24h)
  try {
    console.log('Test 6: getStats() - last 24h');
    const stats = await client.getStats(orgSlug, '24h');
    console.log(`✅ PASS - Got stats for last 24h`);
    console.log(`   Stats: ${JSON.stringify(stats).substring(0, 100)}...`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Test 7: Error handling (404)
  try {
    console.log('Test 7: Error handling - 404');
    await client.getIssue(orgSlug, '999999999');
    console.log('❌ FAIL - Should have thrown 404 error');
    testsFailed++;
  } catch (error) {
    if (error.message.includes('404')) {
      console.log('✅ PASS - Correctly handled 404 error');
      testsPassed++;
    } else {
      console.log(`❌ FAIL - Wrong error: ${error.message}`);
      testsFailed++;
    }
  }
  console.log('');

  // Summary
  console.log('━'.repeat(50));
  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`   Total: ${testsPassed + testsFailed}`);

  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
