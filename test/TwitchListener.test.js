'use strict';
const Taste = require('@jikurata/taste');
const TwitchListener = require('../src/TwitchListener.js');
const config = require('../config/config.js');

config.token_path = 'test/test.json';

Taste.flavor('Writes a token object to test.json')
.describe('Resolves without any errors')
.test(() => {
  const token = {
    "access_token":"0ve4j2ga1d75ttkirf2sox1ds7avjw",
    "expires_in":4787353,
    "scope":["openid"],
    "token_type":"bearer"
  };
  const listener = new TwitchListener(config);
  Taste.profile.saveAccessTokenTest = listener.saveAccessToken(token);
})
.expect('saveAccessTokenTest').toBeTruthy();

Taste.flavor('Reads the contents of test.json')
.describe('Returns the token as a json object')
.test(() => {
  const listener = new TwitchListener(config);
  Taste.profile.readAccessTokenTest = listener.readAccessToken();
})
.expect('readAccessTokenTest').toBeTruthy();
