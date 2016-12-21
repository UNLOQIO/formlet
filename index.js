'use strict';
const nodeFetch = require('node-fetch-abort'),
  util = require('./lib/util'),
  url = require('url');
/**
 * The formlet.io package enables back-ends to communicate with the formlet.io API
 * Usage
 */
const cfg = Symbol();
class FormletClient {

  /**
   * Client configuration
   *  - config.key -> the API Key , defaults to process.env.FORMLET_KEY
   *  - config.url -> the public formlet.io URL, defaults to https://formlet.io
   * */
  constructor(config) {
    if (typeof config !== 'object' || !config) {
      throw new Error('Formlet requires a configuration object in its constructor');
    }
    config = Object.assign({}, {
      key: process.env.FORMLET_KEY,
      url: 'https://formlet.io',
      dispatch: '/dispatch'
    }, config);
    if (typeof config.key !== 'string' || !config.key) {
      throw new Error('Formlet requires an API key to work');
    }
    let d = url.parse(config.url),
      parsed = d.protocol + '//' + d.host;
    if (config.dispatch.charAt(0) !== '/') config.dispatch = '/' + config.dispatch;
    parsed += config.dispatch;
    config.url = parsed;
    this[cfg] = config;
  }

  /**
   * Performs formlet and namespace synchronization with the backend, given the JSON structure of the namespace and formlets.
   * */
  sync(data) {
    if (typeof data !== 'object' || !data) {
      return Promise.reject(util.error('DATA.REQUIRED', 'Synchronization data is required'));
    }
    return this.dispatch('api.sync', data);
  }

  /**
   * This will create a new entry with the given payload.
   * */
  createEntry(namespace, formlet, payload) {
    if (typeof payload !== 'object' || !payload) payload = {};
    payload.namespace = namespace;
    payload.formlet = formlet;
    return this.dispatch('entry.save', payload);
  }

  /**
   * Returns the information of the given entry
   * Custom fields:
   *  - page -> for pagination
   *  - limit -> the limit of items (if the formlet allows multiple entries)
   *  - start_date -> the start date to filter by
   *  - end_date -> the end date to filter by.
   * */
  getEntry(namespace, formlet, payload) {
    if (typeof payload !== 'object' || !payload) payload = {};
    payload.namespace = namespace;
    payload.formlet = formlet;
    return this.dispatch('entry.read', payload).then((res) => {
      if (res.result instanceof Array) return res;  // returns meta also.
      return res.result;
    });
  }

  /**
   * This will return the fields representation of a formlet.
   * OPTIONS:
   *  - is_required - returns only required fields
   *  - type - returns fields of a given type.
   * */
  getFields(namespace, formlet, opt) {
    if (typeof opt !== 'object' || !opt) opt = {};
    opt.namespace = namespace;
    opt.formlet = formlet;
    return this.dispatch('formlet.field.find', opt).then((r) => r.result);
  }

  /*
   * Performs a generic dispatch event
   * */
  dispatch(action, payload) {
    let opt = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'connection': 'keep-alive',
        'authorization': 'Bearer ' + this[cfg].key
      },
      timeout: 10000
    };
    let bodyPayload = {
      type: action,
      payload: {}
    };
    if (typeof payload === 'object' && payload) {
      bodyPayload.payload = payload;
    }
    try {
      opt.body = JSON.stringify(bodyPayload);
    } catch (e) {
      return Promise.reject(util.error('DATA.INVALID', 'The requested payload is not valid'));
    }
    let statusCode;
    let url = this[cfg].url;
    return nodeFetch(url, opt)
      .then((res) => {
        statusCode = res.status;
        return res.json();
      }).then((resultData) => {
        if (statusCode >= 200 && statusCode <= 299) {
          if (resultData.type) {
            delete resultData.type;
          }
          return Promise.resolve(resultData);
        }
        if (resultData.error && resultData.code) {
          // fields are missing
          let err = util.error(resultData.code, resultData.message, statusCode);
          err.fields = resultData.error;
          err.ns = 'FORMLET';
          throw err;
        }
        const errData = resultData.error || {},
          msg = errData.message || 'Could not contact formlet servers',
          status = errData.status || 400,
          code = (errData.code || 'GLOBAL.ERROR');
        let err = util.error(code, msg, status);
        if (!err.data) err.data = {};
        err.data.action = action;
        throw err;
      }).catch((e) => {
        if (e && (e.ns === 'GLOBAL' || e.ns === 'FORMLET')) return Promise.reject(e);
        let msg = '',
          status = 400,
          code = 'GLOBAL.';
        if (e) {
          if (e instanceof SyntaxError) {
            code += 'RESPONSE';
            msg = 'Request data could not be processed.';
          } else {
            switch (e.type) {
              case 'request-timeout':
                code += 'TIMEOUT';
                msg = 'Request timed out';
                break;
              default:
                code += 'ERROR';
                msg = 'Could not contact the server';
                status = statusCode || 400;
            }
          }
        }
        let tErr = util.error(code, msg, status);
        if (!tErr.data) tErr.data = {};
        tErr.source = e;
        tErr.data.action = action;
        return Promise.reject(tErr);
      });
  }

}
module.exports = FormletClient;