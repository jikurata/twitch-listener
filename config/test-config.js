'use strict';
const config = require('./config.js');
config.environment = 'test';
config.webhook_duration = 0;

const testConfigFS = {};
  Object.keys(config).forEach(key => testConfigFS[key] = config[key]);
  testConfigFS.token_path = 'test/test.json';
  
const testConfigAccessToken = {}
Object.keys(config).forEach(key => testConfigAccessToken[key] = config[key]);
testConfigAccessToken.token_path = 'test/token.json';

const testConfigWebhook = {}
Object.keys(config).forEach(key => testConfigWebhook[key] = config[key]);
testConfigWebhook.token_path = 'test/cred.json';
testConfigWebhook.webhook_duration = 60;

module.exports.testConfigFS = testConfigFS;
module.exports.testConfigAccessToken = testConfigAccessToken;
module.exports.testConfigWebhook = testConfigWebhook;
