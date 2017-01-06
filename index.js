'use strict';
const FormletClient = require('./lib/client');
/**
 * The formlet.io package enables back-ends to communicate with the formlet.io API
 * Usage
 */
module.exports = FormletClient;
const apiCache = {};
/*
 * Factory for API caching
 * */
module.exports.instance = function Create(name, opt) {
  if (typeof name === 'undefined') {
    return apiCache['default'] || null;
  }
  if (typeof name === 'object' && name) {
    opt = name;
    name = 'default';
  }
  if (typeof apiCache[name] === 'undefined') {
    let apiObj = new FormletClient(opt);
    apiCache[name] = apiObj;
  }
  return apiCache[name];
};
