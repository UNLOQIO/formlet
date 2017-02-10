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
  create(payload, filter, meta) {
    if (typeof payload !== 'object' || !payload) payload = {};
    _setFormlet(this, payload);
    return this.request('entity.create', this._payload, arguments);
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
  update(payload) {
    if (typeof payload !== 'object' || !payload) payload = {};
    _setFormlet(this, payload);
    return this.request('entity.update', this._payload, arguments);
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
  read(payload) {
    if (typeof payload !== 'object' || !payload) payload = {};
    _setFormlet(this, payload);
    return this.request('entity.read', this._payload, arguments);
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
    _setFormlet(this, payload);
    return this.request('entity.find', this._payload, arguments);
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
    _setFormlet(this, payload);
    return this.request('entity.delete', this._payload, arguments);
  }

  /*
   * Returns the entire history of a single entry
   * Pagination data is similar to find()
   *
   * */
  history(payload, filter) {
    if (typeof payload !== 'object' || !payload) payload = {};
    _setFormlet(this, payload);
    return this.request('entity.history', this._payload, arguments);
  }

  /*
   * Returns the CRUDF operations for a specific formlet
   * No need to pass the formlet for each CRUDF operation.
   * */
  formlet(formlet, includePayload) {
    if (typeof formlet !== 'string' || !formlet) throw new Error('formlet.formlet() requires a string');
    let ctx = {
      _formlet: formlet,
      dispatch: this.dispatch.bind(this)
    };
    ctx.request = this.request.bind(ctx);
    if (includePayload) {
      ctx._payload = true;
    }
    ctx.cerate = this.create.bind(ctx);
    ctx.read = this.read.bind(ctx);
    ctx.update = this.update.bind(ctx);
    ctx.delete = this.delete.bind(ctx);
    ctx.find = this.find.bind(ctx);
    ctx.history = this.history.bind(ctx);
    return ctx;
  }


  /**
   * Performs formlet and namespace synchronization with the backend, given the JSON structure of the namespace and formlets.
   * */
  sync(data) {
    if (typeof data !== 'object' || !data) {
      return Promise.reject(util.error('DATA.REQUIRED', 'Synchronization data is required'));
    }
    return this.dispatch('api.sync', data, null, null, {
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
  dispatch(action, payload, filter, meta, _opt) {
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
    if (typeof meta === 'object' && meta) {
      bodyPayload.meta = meta;
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
        if (typeof err.data !== 'object' || !err.data) err.data = {};
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

  /*
   * Small wrapper over dispatch() to process filter/payload/meta
   * */
  request(action, withPayload, args) {
    let tmp = Array.prototype.slice.call(args);
    let payload = tmp[0],
      filter = tmp[1],
      meta = tmp[2];
    if (typeof payload !== 'object' || !payload) payload = {};
    if (typeof filter === 'undefined' && typeof payload.filter === 'object') {
      filter = payload.filter;
    }
    if (typeof meta === 'undefined' && typeof payload.meta === 'object') {
      meta = payload.meta;
    }
    if (typeof payload.payload === 'object' && payload.payload) {
      payload = payload.payload;
    }
    if (typeof this._formlet === 'string') {
      if (typeof payload.formlet !== 'string' || !payload.formlet) {
        payload.formlet = this._formlet;
      } else {
        let tmp = payload.formlet.indexOf(this._formlet);
        if (tmp !== 0) { // append the payload.formlet in _formlet.
          payload.formlet = this._formlet + '.' + payload.formlet;
        }
      }
    }

    return this.dispatch(action, payload, filter, meta).then((r) => {
      if (!withPayload) {
        if (typeof r.meta !== 'undefined') {
          return {
            result: r.result,
            meta: r.meta
          };
        }
        return r.result;
      }
      r.request = {
        payload,
        filter,
        meta: meta || {}
      };
      return r;
    });
  }

}

function _setFormlet(ctx, payload) {
  if (typeof ctx._formlet === 'undefined') return;
  if (typeof payload.formlet === 'undefined') {
    payload.formlet = ctx._formlet;
  } else {
    if (typeof payload.formlet === 'string' && payload.formlet.indexOf(ctx._formlet) !== 0) {
      payload.formlet = ctx._formlet + '.' + payload.formlet;
    }
  }
}

module.exports = FormletClient;