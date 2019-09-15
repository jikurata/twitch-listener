'use strict';
require('dotenv').config();

const webhooks = require('./twitchwebhooks.js');

const config = {
  'isProduction': process.env.NODE_ENV === 'production',
  'username': process.env.TWITCH_USERNAME,
  'client_id': process.env.CLIENT_ID,
  'client_secret': process.env.CLIENT_SECRET,
  'hub_secret': process.env.HUB_SECRET,
  'port': process.env.PORT,
  'token_path': process.env.TOKEN_PATH,
  'webhook_endpoints': webhooks,
  'webhook_duration': process.env.WEBHOOK_DURATION,
  'callback_url': process.env.WEBHOOK_CALLBACK
};

module.exports = config;
