'use strict';
/**
 * The Formlet client that performs actual actions on the back-end.
 */
const nodeFetch = require('node-fetch-abort'),
  util = require('./util'),
  url = require('url');

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
   * ENTRY OPERATIONS
   * The following CRUDF operations will be performed on the given entries.
   * */
  /*
   * This will create a new entry with the given payload.
   * Arguments
   *  - payload.namespace - the namespace we want to use.
   *  - payload.formlet - the formlet we want to use.
   *  - payload.created_by - the created by field.
   * */
  create(payload) {
    if (typeof payload !== 'object' || !payload) payload = {};
    if (typeof this.ns === 'string') payload.namespace = this.ns;
    if (typeof payload.namespace !== 'string') return Promise.reject(util.error('DATA.REQUIRED', 'Missing namespace information'));
    if (typeof payload.formlet !== 'string') return Promise.reject(util.error('DATA.REQUIRED', 'Missing formlet information'));
    if (typeof payload.created_by !== 'string') return Promise.reject(util.error('DATA.REQUIRED', 'Missing created by information'));
    return this.dispatch('entry.create', payload).then((r) => {
      if (!this._payload) return r.result;
      r.payload = payload;
      return r;
    });
  }

  /*
   * Performs an update on an existing entry if the formlet allows it.
   * Arguments
   *  - payload.namespace - the namespace of the entry, required.
   *  - payload.formlet - the formlet of the entry, optional
   *  - payload.id - the ID of the entry, required
   *  - payload.updated_by - the ID of the entity that updated this entity, required.
   *  - filter.{keyName} - additional querying filters to apply to the entry.

   * */
  update(payload, filter) {
    if (typeof payload !== 'object' || !payload) payload = {};
    if (typeof this.ns === 'string') payload.namespace = this.ns;
    if (typeof payload.namespace !== 'string' || !payload.namespace) return Promise.reject(util.error('DATA.REQUIRED', 'Missing namespace information'));
    if (typeof payload.id !== 'string' || !payload.id) return Promise.reject(util.error('DATA.REQUIRED', 'Missing entry.id'));
    if (typeof payload.updated_by === 'undefined') return Promise.reject(util.error('DATA.REQUIRED', 'Missing updated by information'))
    return this.dispatch('entry.update', payload, filter).then((r) => {
      if (!this._payload) return r.result;
      r.payload = payload;
      return r;
    });
  }

  /*
   * Performs a read on an entry via its id.
   * IF no formlet is specified we will not send it.
   * Arguments
   *  - payload.namespace - the namespace of the entry, required.
   *  - payload.formlet - the formlet of the entry, optional
   *  - payload.id - the entry id, required
   *  - filter.{keyName} - additional filters to apply when reading.
   * */
  read(payload, filter) {
    if (typeof payload !== 'object' || !payload) payload = {};
    if (typeof this.ns === 'string') payload.namespace = this.ns;
    if (typeof payload.namespace !== 'string' || !payload.namespace) return Promise.reject(util.error('DATA.REQUIRED', 'Missing namespace information'));
    if (typeof payload.id !== 'string' || !payload.id) return Promise.reject(util.error('DATA.REQUIRED', 'Missing entry.id'));
    return this.dispatch('entry.read', payload, filter).then((r) => {
      if (!this._payload) return r.result;
      r.payload = payload;
      return r;
    });
  }

  /*
   * Performs a find on the given namespace/formlet or just namespace.
   * Pagination fields that can be included:
   *   - meta -> if specified, returns additional metadata for the request.
   *   - page -> the current page for the  result set
   *   - limit -> the result set size, defaults to 10,
   *   - start_date -> the start date to apply to the filter
   *   - end_date -> the end date to apply to the filter
   *   - date_field -> used with start/end date, the field name to use for date filtering (defaults to created_at)
   *   - order -> result set ordering, defaults to DESC. Values are DESC/ASC
   *   - order_by -> result set ordering by a specific field, defaults to create_at
   *
   *   Arguments
   *   - payload.namespace - the namespace of the entry
   *   - payload.formlet - additional formlet(s) to specify.
   *   - filter.{keyName} - additional filtering on the find result.
   * */
  find(payload, filter) {
    if (typeof payload !== 'object' || !payload) payload = {};
    if (typeof this.ns === 'string') payload.namespace = this.ns;
    if (typeof payload.namespace !== 'string' || !payload.namespace) return Promise.reject(util.error('DATA.REQUIRED', 'Missing namespace information'));
    if (typeof payload.formlet === 'string') {
      payload.formlet = payload.formlet.split(' ');
    } else if (typeof payload.formlet === 'object' || typeof payload.formlet === 'undefined' || !payload.formlet) {
      payload.formlet = '_all';
    }
    return this.dispatch('entry.find', payload, filter).then((r) => {
      let b = {
        result: r.result,
        meta: r.meta
      };
      if (this._payload === true) {
        b.payload = payload;
      }
      return b;
    });
  }

  /*
   * Deletes an entry from the given namespace/formlet by its id.
   * Arguments
   *  - payload.namespace
   *  - payload.id
   *  - payload.filter(optional)
   *  - filter.{keyName}
   * */
  delete(payload, filter) {
    if (typeof payload !== 'object' || !payload) payload = {};
    if (typeof this.ns === 'string') payload.namespace = this.ns;
    if (typeof payload.namespace !== 'string' || !payload.namespace) return Promise.reject(util.error('DATA.REQUIRED', 'Missing namespace information'));
    if (typeof payload.id !== 'string' || !payload.id) return Promise.reject(util.error('DATA.REQUIRED', 'Missing entry information'));
    if (typeof payload.deleted_by === 'string') {
      payload.updated_by = payload.deleted_by;
    }
    if (typeof payload.updated_by === 'undefined') return Promise.reject(util.error('DATA.REQUIRED', 'Missing deleted by information'));
    return this.dispatch('entry.delete', payload, filter).then((r) => {
      if (!this._payload) return r.result || {};
      return {
        result: r.result || {},
        payload: payload
      };
    });
  }

  /*
   * Returns the entire history of a single entry
   * Pagination data is similar to find()
   *
   * */
  history(payload, filter) {
    if (typeof payload !== 'object' || !payload) payload = {};
    if (typeof this.ns === 'string') payload.namespace = this.ns;
    if (typeof payload.namespace !== 'string' || !payload.namespace) return Promise.reject(util.error('DATA.REQUIRED', 'Missing namespace information'));
    if (typeof payload.id !== 'string' || !payload.id) return Promise.reject(util.error('DATA.REQUIRED', 'Missing entry information'));
    return this.dispatch('entry.history', payload, filter).then((r) => {
      let b = {
        meta: r.meta,
        result: r.result
      };
      if (this._payload) {
        b.payload = payload;
      }
      return b;
    });
  }

  /*
   * Returns the CRUDF operations for a specific namespace.
   * No need to pass the namespace for each CRUDF operation.
   * */
  namespace(ns, includePayload) {
    if (typeof ns !== 'string' || !ns) throw new Error('formlet.namespace() requires a string');
    let ctx = {
      ns: ns,
      dispatch: this.dispatch.bind(this)
    };
    if (includePayload) {
      ctx._payload = true;
    }
    let wrapper = {
      create: this.create.bind(ctx),
      read: this.read.bind(ctx),
      update: this.update.bind(ctx),
      delete: this.delete.bind(ctx),
      find: this.find.bind(ctx),
      history: this.history.bind(ctx)
    };
    return wrapper;
  }


  /**
   * Performs formlet and namespace synchronization with the backend, given the JSON structure of the namespace and formlets.
   * */
  sync(data) {
    if (typeof data !== 'object' || !data) {
      return Promise.reject(util.error('DATA.REQUIRED', 'Synchronization data is required'));
    }
    return this.dispatch('api.sync', data, null, {
      timeout: 40000
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
  dispatch(action, payload, filter, _opt) {
    let opt = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'connection': 'keep-alive',
        'authorization': 'Bearer ' + this[cfg].key
      },
      timeout: 10000
    };
    if (typeof _opt === 'object' && _opt) {
      if (typeof _opt.headers === 'object' && _opt.headers) {
        Object.assign(opt.headers, _opt.headers);
      }
      Object.keys(_opt).forEach((keyName) => {
        if (keyName === 'headers') return;
        opt[keyName] = _opt[keyName];
      });
    }
    let bodyPayload = {
      type: action,
      payload: {}
    };
    if (typeof payload === 'object' && payload) {
      bodyPayload.payload = payload;
    }
    if (typeof filter === 'object' && filter) {
      bodyPayload.filter = filter;
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
        if (typeof resultData.error && resultData.code === 'FIELD.INVALID') {
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
        err.ns = 'FORMLET';
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