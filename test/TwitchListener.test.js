'use strict';
const Taste = require('@jikurata/taste');
const TwitchListener = require('../src/TwitchListener.js');
const {testConfigFS, testConfigAccessToken, testConfigWebhook} = require('../config/test-config.js');

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
    const listener = new TwitchListener(testConfigFS);
    Taste.profile.saveAccessTokenTest = listener.saveAccessToken(token);
  })
  .expect('saveAccessTokenTest').toBeTruthy();

  Taste.flavor('Reads the contents of test.json')
  .describe('Returns the token as a json object')
  .test(() => {
    const listener = new TwitchListener(testConfigFS);
    Taste.profile.readAccessTokenTest = listener.readAccessToken();
  })
  .expect('readAccessTokenTest').toBeTruthy();
// =====

// Twitch app access token test
  Taste.flavor('Request an app access token from the Twitch API')
  .describe('Returns an app access token as a string')
  .test(() => {
    const listener = new TwitchListener(testConfigAccessToken);
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

// Twitch API user info request test
  Taste.flavor('Request user info based on the username provided in config')
  .describe('Returns an object containing various details about the user')
  .test(() => {
    const listener = new TwitchListener(testConfigAccessToken);
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
    const listener = new TwitchListener(testConfigAccessToken)
    listener.requestActiveWebhooks()
    .then(info => Taste.profile.activeWebhooksTest = info.total)
    .catch(err => Taste.profile.activeWebhooksTest = err);
  })
  .expect('activeWebhooksTest').isTypeOf('number');
// =====

const webhookTestListener = new TwitchListener(testConfigWebhook)
webhookTestListener.launch()
.then(() => {
  // Twitch follow webhook test
  Taste.flavor('Register and unregister a follow webhook')
  .describe('Create and remove a follow webhook')
  .test(() => {
    webhookTestListener.on('add_webhook_follow', () => {
      Taste.profile.webhookFollowAddResult = true;
      webhookTestListener.followWebhook('unsubscribe');
    });
    webhookTestListener.on('remove_webhook_follow', () => {
      Taste.profile.webhookFollowRemoveResult = true;
    });
    webhookTestListener.followWebhook()
    .catch(err => {
      Taste.profile.webhookFollowAddResult = err;
      Taste.profile.webhookFollowRemoveResult = err;
    });
  })
  .expect('webhookFollowAddResult').toBe(true)
  .expect('webhookFollowRemoveResult').toBe(true);
  // =====

  // Twitch change stream webhook test
  Taste.flavor('Register and unregister a change stream webhook')
  .describe('Create and remove a change stream webhook')
  .test(() => {
    webhookTestListener.on('add_webhook_changeStream', () => {
      Taste.profile.webhookChangeStreamAddResult = true;
      webhookTestListener.changeStreamWebhook('unsubscribe');
    });
    webhookTestListener.on('remove_webhook_changeStream', () => {
      Taste.profile.webhookChangeStreamRemoveResult = true;
    });
    webhookTestListener.changeStreamWebhook()
    .catch(err => {
      Taste.profile.webhookChangeStreamAddResult = err;
      Taste.profile.webhookChangeStreamRemoveResult = err;
    });
  })
  .expect('webhookChangeStreamAddResult').toBe(true)
  .expect('webhookChangeStreamRemoveResult').toBe(true);
  // =====

  // Twitch change profile webhook test
  Taste.flavor('Register and unregister a change profile webhook')
  .describe('Create and remove a change profile webhook')
  .test(() => {
    webhookTestListener.on('add_webhook_changeProfile', () => {
      Taste.profile.webhookChangeProfileAddResult = true;
      webhookTestListener.changeProfileWebhook('unsubscribe');
    });
    webhookTestListener.on('remove_webhook_changeProfile', () => {
      Taste.profile.webhookChangeProfileRemoveResult = true;
    });
    webhookTestListener.changeProfileWebhook()
    .catch(err => {
      Taste.profile.webhookChangeProfileAddResult = err;
      Taste.profile.webhookChangeProfileRemoveResult = err;
    });
  })
  .expect('webhookChangeProfileAddResult').toBe(true)
  .expect('webhookChangeProfileRemoveResult').toBe(true);
  // =====
});
