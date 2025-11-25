// Test Sentry SDK compatibility with GlitchTip
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: 'http://a7a6528779f148d68ac5b3079aabfd2e@localhost:8080/1',
  environment: 'test',
  release: 'test@1.0.0',
});

console.log('🧪 Testing Sentry SDK compatibility with GlitchTip...\n');

// Test 1: Basic error
console.log('Test 1: Basic error capture');
Sentry.captureException(new Error('Test error 1: Basic error capture'));

// Test 2: Error with user context
console.log('Test 2: Error with user context');
Sentry.withScope((scope) => {
  scope.setUser({
    id: 'test-123',
    email: 'test@example.com',
    username: 'test_user'
  });
  scope.setTag('test-type', 'user-context');
  Sentry.captureException(new Error('Test error 2: With user context'));
});

// Test 3: Error with breadcrumbs
console.log('Test 3: Error with breadcrumbs');
Sentry.addBreadcrumb({
  category: 'navigation',
  message: 'User navigated to page',
  level: 'info',
});
Sentry.addBreadcrumb({
  category: 'action',
  message: 'User clicked button',
  level: 'info',
});
Sentry.captureException(new Error('Test error 3: With breadcrumbs'));

// Test 4: Error with extra context
console.log('Test 4: Error with extra data');
Sentry.withScope((scope) => {
  scope.setTag('component', 'test-suite');
  scope.setTag('environment', 'local');
  scope.setExtra('test_data', {
    foo: 'bar',
    nested: { a: 1, b: 2 }
  });
  scope.setExtra('timestamp', new Date().toISOString());
  Sentry.captureException(new Error('Test error 4: With extra data'));
});

// Test 5: Error with custom level
console.log('Test 5: Error with custom level (warning)');
Sentry.captureException(new Error('Test error 5: Warning level'), {
  level: 'warning',
});

// Wait for all events to be sent
setTimeout(() => {
  console.log('\n✅ All 5 test errors sent to GlitchTip!');
  console.log('📊 Check GlitchTip UI: http://localhost:8080');
  console.log('   You should see 5 new errors in your project.');
  process.exit(0);
}, 2000);
