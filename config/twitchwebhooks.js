'use strict';

const endpoints = {
  'follow': 'https://api.twitch.tv/helix/users/follows',
  'subscription': 'https://api.twitch.tv/helix/subscriptions/events',
  'changeStream': 'https://api.twitch.tv/helix/streams',
  'changeProfile': 'https://api.twitch.tv/helix/users',
  'createExtensionTransaction': 'https://api.twitch.tv/helix/extensions/transactions',
  'changeModerator': 'https://api.twitch.tv/helix/moderation/moderators/events',
  'changeBan': 'https://api.twitch.tv/helix/moderation/banned/events',
};

module.exports = endpoints;
