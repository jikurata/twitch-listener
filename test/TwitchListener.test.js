'use strict';
const Taste = require('@jikurata/taste');
const TwitchListener = require('../src/TwitchListener.js');

const config = require('../config/config.js');
// TODO: Move configurations into separate file
config.environment = 'test';
config.webhook_duration = 0;

const fsTestConfig = {};
  Object.keys(config).forEach(key => fsTestConfig[key] = config[key]);
  fsTestConfig.token_path = 'test/test.json';
  
const appTokenTestConfig = {}
Object.keys(config).forEach(key => appTokenTestConfig[key] = config[key]);
appTokenTestConfig.token_path = 'test/token.json';

const subscriptionTestConfig = {}
Object.keys(config).forEach(key => subscriptionTestConfig[key] = config[key]);
subscriptionTestConfig.token_path = 'test/cred.json';
subscriptionTestConfig.webhook_duration = 60;

// FS Unit Tests
  Taste.flavor('Writes a token object to test.json')
  .describe('Resolves without any errors')
  .test(() => {
    const token = {
      "access_token":"0ve4j2ga1d75ttkirf2sox1ds7avjw",
      "expires_in":4787353,
      "scope":["openid"],
      "token_type":"bearer"
    };
    const listener = new TwitchListener(fsTestConfig);
    Taste.profile.saveAccessTokenTest = listener.saveAccessToken(token);
  })
  .expect('saveAccessTokenTest').toBeTruthy();

  Taste.flavor('Reads the contents of test.json')
  .describe('Returns the token as a json object')
  .test(() => {
    const listener = new TwitchListener(fsTestConfig);
    Taste.profile.readAccessTokenTest = listener.readAccessToken();
  })
  .expect('readAccessTokenTest').toBeTruthy();
// =====

// Twitch API user info request test
  Taste.flavor('Request user info based on the username provided in config')
  .describe('Returns an object containing various details about the user')
  .test(() => {
    const listener = new TwitchListener(config);
    listener.requestUserInfo()
    .then(info => Taste.profile.userProfileTest = info.id)
    .catch(err => Taste.profile.userProfileTest = err);
  })
  .expect('userProfileTest').isTypeOf('string');
// =====

// Twitch API active webhooks request test
  Taste.flavor('Request the current active webhooks for an application')
  .describe('Returns an object containing information about the webhooks')
  .test(() => {
    const listener = new TwitchListener(config)
    listener.requestActiveWebhooks()
    .then(info => Taste.profile.activeWebhooksTest = info.total)
    .catch(err => Taste.profile.activeWebhooksTest = err);
  })
  .expect('activeWebhooksTest').isTypeOf('number');
// =====

// Twitch app access token test
  Taste.flavor('Request an app access token from the Twitch API')
  .describe('Returns an app access token as a string')
  .test(() => {
    const listener = new TwitchListener(appTokenTestConfig);
    listener.requestAccessToken()
    .then(token => {
      Taste.profile.receivedAccessToken = token;
      return listener.validateAccessToken(token);
    })
    .then(isValid => {
      Taste.profile.validAccessToken = isValid;
      return listener.revokeAccessToken();
    })
    .then(() => Taste.profile.revokeAccessToken = true)
    .catch(err => Taste.profile.receivedAccessToken = err);
  })
  .expect('receivedAccessToken').isTypeOf('string')
  .expect('validAccessToken').toBeTruthy()
  .expect('revokeAccessToken').toBeTruthy();
// =====

// Twitch webhook test
  Taste.flavor('Register and unregister a follow webhook')
  .describe('Request to create a webhook on the user/follow api')
  .test(() => {
    const listener = new TwitchListener(subscriptionTestConfig)
    listener.on('add_webhook_follow', () => {
      Taste.profile.webhookAddResult = true;
      listener.followWebhook('unsubscribe');
    });
    listener.on('remove_webhook_follow', () => {
      Taste.profile.webhookRemoveResult = true;
      listener.close();
    });
    listener.launch()
    .then(() => listener.followWebhook())
    .catch(err => {
      Taste.profile.webhookAddResult = err;
      Taste.profile.webhookRemoveResult = err;
    });
  })
  .expect('webhookAddResult').toBe(true)
  .expect('webhookRemoveResult').toBe(true);
// =====
