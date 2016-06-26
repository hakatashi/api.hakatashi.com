const request = require('request');
const FileCookieStore = require('tough-cookie-filestore');

// Initialize cookie jar
const jar = request.jar(new FileCookieStore('cookie.json'));

module.exports = jar;
