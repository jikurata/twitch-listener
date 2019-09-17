'use strict';
const EventEmitter = require('events');
const bodyParser = require('body-parser');
const express = require('express');
const Request = require('request');
const crypto = require('crypto');
const FS = require('fs');
const HTTP = require('http');
const PATH = require('path');
const init = Symbol('init');

class TwitchListener extends EventEmitter {
  constructor(config) {
    super();
    Object.defineProperty(this, 'app', {
      value: express(),
      enumerable: true,
      writable: false,
      configurable: false
    });
    Object.defineProperty(this, 'server', {
      value: HTTP.createServer(this.app),
      enumerable: true,
      writable: false,
      configurable: false
    });
    Object.defineProperty(this, 'port', {
      value: config.port || 3000,
      enumerable: true,
      writable: false,
      configurable: false
    });
    Object.defineProperty(this, 'client_id', {
      value: config.client_id,
      enumerable: true,
      writable: false,
      configurable: false
    });
    Object.defineProperty(this, 'client_secret', {
      value: config.client_secret,
      enumerable: false,
      writable: false,
      configurable: false
    });
    Object.defineProperty(this, 'username', {
      value: config.username,
      enumerable: false,
      writable: false,
      configurable: false
    });
    Object.defineProperty(this, 'hub_secret', {
      value: config.hub_secret,
      enumerable: false,
      writable: false,
      configurable: false
    });
    Object.defineProperty(this, 'webhook_endpoints', {
      value: config.webhook_endpoints,
      enumerable: false,
      writable: false,
      configurable: false
    });
    Object.defineProperty(this, 'webhook_duration', {
      value: config.webhook_duration,
      enumerable: false,
      writable: false,
      configurable: false
    });
    Object.defineProperty(this, 'callback_url', {
      value: config.callback_url,
      enumerable: false,
      writable: false,
      configurable: false
    });
    Object.defineProperty(this, 'token_path', {
      value: config.token_path,
      enumerable: false,
      writable: false,
      configurable: false
    });
    Object.defineProperty(this, 'token', {
      value: {},
      enumerable: false,
      writable: false,
      configurable: false
    });
    Object.defineProperty(this, 'profile', {
      value: {},
      enumerable: false,
      writable: false,
      configurable: false
    });
    Object.defineProperty(this, 'environment', {
      value: config.environment,
      enumerable: false,
      writable: false,
      configurable: false
    });
    this[init]();
  }

  [init]() {
    if ( !this.username ) {
      throw new Error('A Twitch username must be provided to attach webhook subscriptions');
    }
    if ( !this.client_id || !this.client_secret ) {
      throw new Error(`A client id and client secret must be provided to access the Twitch API.`);
    }
    if ( !this.hub_secret ) {
      throw new Error(`A secret must be provided to verify twitch signatures`);
    }
    if ( this.webhook_duration < 0 ) {
      throw new Error('Webhook duration must be between 0 and 86400. Add a value to WEBHOOK_DURATION in .env');
    }
    if ( !this.callback_url ) {
      throw new Error('A callback url must be provided for Twitch to send webhook updates to');
    }
    if ( !this.token_path ) {
      console.warn('No filepath specified to store access token. Consider adding the TOKEN_PATH variable to .env');
    }
    if ( this.environment !== 'test' || this.environment !== 'production' ) {
      console.warn('Not in production mode. Set NODE_ENV=production in .env');
    }

    // Pass requests through body-parser middleware (Parses any query strings or bodys into objects)
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({
      'extended': true
    }));

    if ( this.enivironment !== 'production' ) {
      this.app.use((req, res, next) => {
        next();
      });
    }

    // Validate incoming requests to ensure they are coming from Twitch
    this.app.post('*', (req, res, next) => {
      const header = req.headers['x-hub-signature'];
      if ( header ) {
        const signature = header.split('=');
        const hash = crypto.createHmac(signature[0], this.hub_secret)
        .update(JSON.stringify(req.body))
        .digest('hex');

        if ( signature[1] === hash ) {
          return next();
        }
      }
      // Reject invalidated requests
      res.status(401).end();
    });
    
    Object.keys(this.webhook_endpoints).forEach(topic => {
      ((topic) => {
        const route = '/' + topic.toLowerCase();
        // Endpoint to handle incoming Twitch Challenge Requests
        this.app.get(route, (req, res) => {
          // Determine if the incoming request is a webhook challenge
          if ( req.query && req.query['hub.challenge'] ) {
            // Once the Twitch API receives the response, the webhook will be active
            res.send(req.query['hub.challenge']);
            if ( req.query['hub.mode'] === 'subscribe' ) {
              console.log(`Added webhook for ${topic}`);
              this.emit(`add_webhook_${topic}`)
            }
            if ( req.query['hub.mode'] === 'unsubscribe' ) {
              console.log(`Removed webhook for ${topic}`);
              this.emit(`remove_webhook_${topic}`)
            }
          }
  
          res.status(200).end();
        });
  
        // Endpoint to handle incoming Webhook Requests
        this.app.post(route, (req, res) => {
          this.emit(topic, req.body);
          res.status(200).end();
        });
      })(topic);
    });

    // 404 all invalid requests
    this.app.use('*', (req, res) => {
      res.status(404).end();
    });
  }

  /**
   * Attempts to start a http server at the provided port
   * Will resolve if successful and emit a ready event
   * Otherwise rejects the promise
   * @returns {Promise}
   */
  launch() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, (err) => {
        if ( err ) {
          return reject(err);
        }
        console.log(`Twitch Listener ready at port ${this.port}`);
        
        // Create all supported webhooks
        this.createWebhooks()
        .then(() => {
          this.emit('ready');
          resolve();
        });
      });
    })
    .catch(err => {
      console.error(err);
      return err;
    });
  }

  /**
   * Closes the server
   * @returns {Promise}
   */
  close() {
    return this.server.close()
  }

  /**
   * Subscribes to all webhooks available.
   * @returns {Promise}
   */
  createWebhooks() {
    return new Promise((resolve, reject) => {
      this.requestAccessToken()
      .then(token => {
        const webhooks = [
          this.followWebhook(),
          this.profileChangeWebhook(),
          this.streamChangeWebhook()
        ];
        let done = 0;
        for ( let i = 0; i < webhooks.length; ++i ) {
          webhooks[i]
          .then(() => {
            if ( ++done  >= webhooks.length ) {
              resolve();
            }
          })
          .catch(err => {
            console.error(err);
            if ( ++done  >= webhooks.length ) {
              resolve();
            }
          });
        }
      })
      .catch(err => reject(err));
    })
    .catch(err => {
      console.error(err);
      return err;
    });
  }

  /**
   * Create a webhook manually
   * @param {String} topic A supported Webhook topic
   * @param {Object} options 
   * options fields:
   *  {String} query: a query string to append to a Twitch endpoint
   *  {String} mode: 'subscribe' or 'unsubscribe' (Default: 'subscribe')
   *  {Object} Header: Additional headers to append to the request
   */
  webhook(topic, options = {}) {
    const callback = `${this.callback_url}/${topic.toLowerCase()}`;
    const topicUrl = this.webhook_endpoints[topic];
    const query = (options.query) ? options.query : '';
    const fullTopicUrl = `${topicUrl}${query}`;
    const mode = (options.mode) ? options.mode : 'subscribe';
    const header = {
      'Client-ID': this.client_id,
      'Content-Type': 'application/json'
    };

    // Add additional headers if available
    if ( options.headers && typeof options.headers === 'object' ) {
      Object.keys(options.headers).forEach(field => {
        header[field] = options.headers[field];
      });
    }

    const body = JSON.stringify({
      'hub.callback': callback,
      'hub.mode': mode,
      'hub.topic': fullTopicUrl,
      'hub.lease_seconds': this.webhook_duration,
      'hub.secret': this.hub_secret
    });

    return new Promise((resolve, reject) => {
      if ( !this.webhook_endpoints.hasOwnProperty(topic) ) {
        return reject(new Error(`${topic} is not a valid hub topic. Review config/twitchwebhooks.js for the valid hub topics`));
      }

      // Retrieve current webhooks and check if the current topicUrl exists already
      this.requestActiveWebhooks()
      .then(result => {
        // Inspect each webhook in the data field
        const promises = [];
        if ( result.data && result.data.length ) {
          for ( let i = 0; i < result.data.length; ++i ) {
            const webhook = result.data[i];
            // topic and callback match means this webhook is active already
            if (  webhook.topic === fullTopicUrl  && webhook.callback_url === callback) {

              // Kill the current webhook
              const o = {};
              Object.keys(options).forEach(field => o[field] = options[field]);
              o.mode = 'unsubscribe';
              promises.push(this.webhook(topic, o));
            }
          }
        }
        return Promise.all(promises);
      })
      .then(() => this.request({
        url: 'https://api.twitch.tv/helix/webhooks/hub',
        method: 'POST',
        headers: header,
        body: body
      }))
      .then(res => {
        if ( res.statusCode !== 202 ) {
          return reject(res.body);
        }
        else {
          console.log(`Requesting webhook ${mode} for ${topic}`);
          resolve();
        }
      })
      .catch(err => reject(err));
    });
  }

  /**
   * Create a follow webhook for the username provided in the configuration
   * Listen to 'add_webhook_follow' for true confirmation for a webhook's creation
   * Listen to 'remove_webhook_follow' for true confirmation for a webhook's deletion
   * These are emitted once Twitch's challenge request has been accepted by this application
   * @returns {Promise}
   */
  followWebhook(mode = 'subscribe') {
    return this.requestUserInfo()
    .then(info => {
      const id = info.id;
      return this.webhook('follow', {
        mode: mode,
        query: `?first=1&to_id=${id}`
      });
    });
  }

  _subscriptionWebhook(mode = 'subscribe') {
    let accessToken = null;
    this.requestAccessToken()
    .then(token => {
      accessToken = token;
      return this.requestUserInfo();
    })
    .then(info => {
      return this.webhook('subscription', {
        mode: mode,
        header: {
          'Authorization': `Bearer ${accessToken}`
        },
        query: `?broadcaster_id=${info.id}&first=1`
      });
    });
  }

  profileChangeWebhook(mode = 'subscribe') {
    return this.requestUserInfo()
    .then(info => {
      const id = info.id
      return this.webhook('changeProfile', {
        mode: mode,
        query: `?id=${id}`
      });
    });
  }

  streamChangeWebhook(mode = 'subscribe') {
    return this.requestUserInfo()
    .then(info => {
      const id = info.id
      return this.webhook('changeStream', {
        mode: mode,
        query: `?user_id=${id}`
      });
    });
  }

  _extensionTransactionWebhook(mode = 'subscribe') {
    let accessToken = null;
    this.requestAccessToken()
    .then(token => {
      accessToken = token;
      return this.requestUserExtensions();
    })
    .then(extensions => {
      if ( !extensions.length ) {
        return;
      }
      const promises = [];
      for ( let i = 0; i < extensions.length; ++i ) {
        ((extension) => {
          promises.push(this.webhook('extensionTransaction', {
            mode: mode,
            header: {
              'Authorization': `Bearer ${accessToken}`
            },
            query: `?extension_id=${extension.id}&first=1`
          }))
        })(extensions[i]);
      }
      return Promise.all(promises);
    });
  }

  _moderatorChangeWebhook() {
    return new Promise((resolve, reject) => {
      console.warn('subscribeToModeratorChange is not yet implemented');
      resolve();
    });
  }

  _banChangeWebhook() {
    return new Promise((resolve, reject) => {
      console.warn('subscribeToBanChange is not yet implemented');
      resolve();
    });
  }

  /**
   * Requests a user profile
   * @param {String} username
   * @returns {Promise} 
   * Resolves with an object containing details about the username
   * Rejects with an error
   */
  requestUserInfo() {
    return new Promise((resolve, reject) => {
      if ( this.profile.hasOwnProperty('id') ) {
        return resolve(this.profile);
      }
      this.request({
        url: `https://api.twitch.tv/helix/users?login=${this.username}`,
        method: 'GET',
        headers: {
          'Client-ID': this.client_id
        }
      })
      .then(res => {
        try {
          const body = JSON.parse(res.body);
          if ( body.data.length ) {
            const profile = body.data[0];
            // Store the user profile in memory
            Object.keys(profile).forEach(field => {
              this.profile[field] = profile[field];
            });
            return resolve(profile);
          }
          return reject(new Error(`No profile found for username ${this.username}`));
        }
        catch(err) {
          return reject(err);
        }
      })
      .catch(err => reject(err));
    })
  }

  /**
   * Retrieve a list of extensions used by the user associated with the access token
   * @returns {Promise}
   * Resolves with an array containing all of the users exensions
   * Rejects with an error
   */
  _requestUserExtensions() {
    return new Promise((resolve, reject) => {
      this.requestAccessToken()
      .then(token => this.request({
        url: 'https://api.twitch.tv/helix/users/extensions/list',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      }))
      .then(res => {
        console.log(res.body);
        try {
          return resolve(JSON.parse(res.body));
        }
        catch(err) {
          return reject(err);
        }
      })
      .catch(err => reject(err));
    });
  }

  /**
   * Request active webhooks on the application
   * @returns {Promise}
   */
  requestActiveWebhooks() {
    return new Promise((resolve, reject) => {
      this.requestAccessToken()
      .then(token => this.request({
        url: 'https://api.twitch.tv/helix/webhooks/subscriptions',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      }))
      .then(res => {
        try {
          return resolve(JSON.parse(res.body));
        }
        catch(err) {
          return reject(err);
        }
      })
      .catch(err => reject(err));
    });
  }

  /**
   * TODO: Refactor procedure to procure User Access Tokens instead of App Access Tokens
   * Performs a sequence of operations to retrieve a valid access token
   * 1. Checks if this.token_path has a valid token
   * 2. Otherwise retrieves a new token from from the server
   * 3. Stores the token at this.token_path
   * Invalid existing tokens will also be revoked through the Twitch API
   * @returns {Promise}
   * Resolves with a String
   * Rejects with an Error
   */
  requestAccessToken() {
    return new Promise((resolve, reject) => {
      // Retrieve an existing token from this.token_path
      const obj = this.readAccessToken();
      const accessToken = this.parseToken(obj);

      // Check validity of accessToken
      this.validateAccessToken(accessToken)
      .then(isValid => {
        if ( accessToken ) {
          // Return the token if it exists and is still valid
          if ( isValid ) {
            return resolve(accessToken);
          }

          // Revoke access token rights if it is no longer valid
          this.revokeAccessToken(accessToken);
        }

        // Request a new access token
        return this.request({
          url: 'https://id.twitch.tv/oauth2/token',
          method: 'POST',
          headers: {},
          qs: {
            client_id: this.client_id,
            client_secret: this.client_secret,
            grant_type: 'client_credentials',
            scope: 'openid user:read:broadcast analytics:read:extensions analytics:read:games bits:read channel:read:subscriptions user:read:email',
          }
        });
      })
      .then(res => {
        // Save the new access token for future reference
        this.saveAccessToken(res.body);
        const newToken = this.parseToken(res.body);
        if ( newToken ) {
          return newToken;
        }
        else {
          return reject(new Error(`Could not parse an access token from ${res.body}`));
        }
      })
      .catch(err => reject(err));
    });
  }

  /**
   * Ensures the provided token is still valid
   * @param {Object|String} token 
   * @returns {Promise}
   * Resolves with a Boolean representing the validity of the token
   * Rejects with an error
   */
  validateAccessToken(token) {
    return new Promise((resolve, reject) => {
      if ( !token ) {
        return resolve(false);
      }
      // If the argument passed is an object, assume the object is an oauth2 access token object
      if ( token && typeof token === 'object') {
        token = token.access_token;
      }
      this.request({
        url: 'https://id.twitch.tv/oauth2/validate',
        method: 'GET',
        headers: {
          'Authorization': `OAuth ${token}`
        }
      })
      .then(res => {
        // if the response body contains client_id, it is a valid token
        resolve(res.body.match('client_id'));
      })
      .catch(err => reject(err));
    });
  }

  /**
   * Requests Twitch to invalidate the provided token
   * @param {Object|String} token
   * @returns {Promise}
   * Rejects with an error
   */
  revokeAccessToken(token) {
    // If the argument passed is an object, assume the object is an oauth2 access token object
    if ( token && typeof token === 'object') {
      token = token.access_token;
    }
    return this.request({
      url: 'https://id.twitch.tv/oauth2/revoke',
      method: 'POST',
      headers: {},
      qs: {
        client_id: this.client_id,
        token: token
      }
    })
    .then((res) => console.log(`Revoked access token: ${token}`))
    .catch(err => console.error(`Could not revoke access token ${token}`, err));
  }

  /**
   * Synchronously writes the access token to this.token_path
   * Does not throw errors as failure in the operation is not considered critical
   * @param {String|Object} token
   * @returns {Boolean} True if success, false if failed
   */
  saveAccessToken(token) {
    const filepath = this.token_path;
    if ( !filepath ) {
      return;
    }
    try {
      // Attempt to convert the argument to a string if not already one
      if ( typeof token !== 'string' ) {
        token = JSON.stringify(token);
      }
      
      // Create filepath if it doesn't exist
      ensureDirectoryExistence(filepath);

      // Write the token to the filepath
      FS.writeFileSync(filepath, token);

      
      // Store the token in memory
      try{
        const obj = JSON.parse(token);
        Object.keys(obj).forEach(field => {
          this.token[field] = obj[field];
        });
      }
      catch(err) { 
        console.error('Could not store the access token in memory', err);
      }
      
      console.log(`Saved access token at ${filepath}`, token)
      return true
    }
    catch(err) { 
      console.error(`Could not save the access token ${token} at ${filepath}`, err);
      return false;
    }

    function ensureDirectoryExistence(filePath) {
      var dirname = PATH.dirname(filePath);
      if (FS.existsSync(dirname)) {
        return true;
      }
      ensureDirectoryExistence(dirname);
      FS.mkdirSync(dirname);
    }
  }

  /**
   * Reads the access token from this.token_path
   * Returns null if it cannot read the filepath
   * Does not throw errors as failure in the operation is not considered critical
   * @returns {Object}
   */
  readAccessToken() {
      const filepath = this.token_path;
      try {
        // If there is a token stored in memory already, then return it
        if ( this.token.hasOwnProperty('access_token') ) {
          return this.token;
        }

        // Return null if filepath does not exist
        if ( !filepath || !FS.existsSync(filepath) ) {
          return null;
        }
        
        // Attempt to read the file and convert it into json
        const data = FS.readFileSync(filepath);
        if ( data ) {
          return JSON.parse(data);
        }
      }
      catch(err) { 
        console.error(`Could not read ${filepath}`, err);
        return null;
      }
  }
  
  /**
   * Promise wrapper for the request module
   * @param {RequestOptions} options
   * @returns {Promise}
   * Resolves with a http response
   * Rejects with an error
   */
  request(options = {}) {
    return new Promise((resolve, reject) => {
      Request(options, (err, res) => {
        if ( err ) {
          return reject(err);
        }
        return resolve(res);
      });
    });
  }

  /**
   * Returns the access token from a json 
   * @param {Object|String} token
   * @returns {String}
   */
  parseToken(token) {
    if ( token && typeof token === 'object' ) {
      return token.access_token;
    }
    else if ( typeof token === 'string' ) {
      try {
        const obj = JSON.parse(token);
        return obj.access_token;
      }
      catch(err) {
        return null;
      }
    }
    return null;
  }
}

module.exports = TwitchListener;
