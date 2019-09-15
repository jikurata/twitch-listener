'use strict';
const EventEmitter = require('events');
const bodyParser = require('body-parser');
const express = require('express');
const Request = require('request');
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
    Object.defineProperty(this, 'isProduction', {
      value: config.isProduction,
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
    if ( !this.callback_url ) {
      throw new Error('A callback url must be provided for Twitch to send webhook updates to');
    }
    if ( !this.token_path ) {
      console.warn('No filepath specified to store access token. Consider adding the TOKEN_PATH variable to .env');
    }
    if ( !this.isProduction ) {
      console.warn('Not in production mode. Set NODE_ENV=production in .env');
    }

    // Pass requests through body-parser middleware (Parses any query strings or bodys into objects)
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({
      'extended': true
    }));

    if ( !this.isProduction ) {
      // Debug request contents
      this.app.use((req, res, next) => {
        console.log('host', req.hostname);
        console.log('headers', req.headers);
        console.log('query', req.query);
        console.log('body', req.body);
        next();
      });
    }

    this.app.get('/', (req, res) => {
      // Determine if the incoming request is a webhook challenge
      if ( req.query && req.query['hub.challenge'] ) {
        // Once the Twitch API receives the response, the webhook will be active
        res.send(req.query['hub.challenge']);
      }

      res.status(200).end();
    })

    // 404 all invalid requests
    this.app.use('*', (req, res) => {
      res.status(404).end();
    });
  }

  /**
   * Attempts to start a http server at the provided port
   * Will resolve if successful and emit a ready event
   * Otherwise rejects the promise
   * @param {Number} port 
   * @returns {Promise}
   */
  launch(port) {
    return new Promise((resolve, reject) => {
      this.server.listen(port, (err) => {
        if ( err ) {
          return reject(err);
        }
        console.log(`Twitch Listener ready at port ${port}`);
        this.emit('ready');
        return resolve();
      });
    });
  }

  /**
   * 
   * @param {Number} duration 
   */
  listenToFollow(duration) {
    return this.requestUserInfo()
    .then(info => {
      const id = info.id;
      return this.request({
        url: 'https://api.twitch.tv/helix/webhooks/hub',
        method: 'POST',
        headers: {
          'Client-ID': this.client_id,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          'hub.callback': this.callback_url,
          'hub.mode': 'subscribe',
          'hub.topic': `https://api.twitch.tv/helix/users/follows?first=1&to_id=${id}`,
          'hub.lease_seconds': duration,
          'secret': this.hub_secret
        })
      })
    })
    .then(res => {
      if ( res.statusCode === 202 ) {
        console.log(`Listening to follow event for ${duration} seconds`);
      }
      else {
        console.error(res.body);
      }
    });
  }

  listenToProfileChange(duration) {
    return this.requestUserInfo()
    .then(info => {
      const id = info.id;
      return this.request({
        url: 'https://api.twitch.tv/helix/webhooks/hub',
        method: 'POST',
        headers: {
          'Client-ID': this.client_id,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          'hub.callback': this.callback_url,
          'hub.mode': 'subscribe',
          'hub.topic': `https://api.twitch.tv/helix/users?id=${id}`,
          'hub.lease_seconds': duration,
          'secret': this.hub_secret
        })
      })
    })
    .then(res => {
      if ( res.statusCode === 202 ) {
        console.log(`Listening to profile change event for ${duration} seconds`);
      }
      else {
        console.error(res.body);
      }
    });
  }

  /**
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
            scope: 'openid',
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
   * Request webhooks through client access token
   * @returns {Promise}
   */
  requestActiveWebhooks() {
    return this.requestAccessToken()
    .then(token => this.request({
      url: 'https://api.twitch.tv/helix/webhooks/subscriptions',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }))
    .then(res => {
      console.log(res.body);
      return res.body;
    })
    .catch(err => console.error(err));
  }

  /**
   * Ensures the provided token is still valid
   * @param {Object|String} token 
   * @returns {Promise}
   * Resolves with a Boolean representing the validity of the token
   * Rejects with an error
   */
  validateAccessToken(token) {
    // If the argument passed is an object, assume the object is an oauth2 access token object
    if ( token && typeof token === 'object') {
      token = token.access_token;
    }
    return this.request({
      url: 'https://id.twitch.tv/oauth2/validate',
      method: 'GET',
      headers: {
        'Authorization': `OAuth ${token}`
      }
    })
    .then(res => {
      // if the response body contains client_id, it is a valid token
      return res.body.match('client_id');
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
