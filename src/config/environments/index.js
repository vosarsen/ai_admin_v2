// src/config/environments/index.js
const development = require('./development');
const production = require('./production');
const staging = require('./staging');

const environments = {
  development,
  production,
  staging
};

const currentEnv = process.env.NODE_ENV || 'development';

// Merge environment-specific config with base config
module.exports = {
  ...environments[currentEnv],
  env: currentEnv
};