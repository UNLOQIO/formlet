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
   *  - namespace - the namespace that we want to use.
   *  - formlet - the formlet we want to use.
   *  - payload - the actual payload we want to send.
   * */
  create(namespace, formlet, payload, _createdBy) {
    if (typeof namespace !== 'string' || !namespace) return Promise.reject(util.error('DATA.REQUIRED', 'Missing namespace information'));
    if (typeof formlet === 'object' && arguments.length === 2) {
      payload = formlet;
      payload.namespace = namespace;
    } else {
      if (typeof payload !== 'object' || !payload) payload = {};
      if (typeof formlet !== 'string' || !formlet) return Promise.reject(util.error('DATA.REQUIRED', 'Missing formlet information'));
      payload.namespace = namespace;
      payload.formlet = formlet;
      if (typeof _createdBy !== 'undefined') {
        payload.created_by = _createdBy.toString();
      }
    }
    return this.dispatch('entry.create', payload).then((r) => {
      if (!this._payload) return r.result;
      r.payload = payload;
      return r;
    });
  }

  /*
   * Performs an update on an existing entry if the formlet allows it.
   * Ways of calling:
   *  update(namespace, id, payload, _updatedBy)
   *  update(namespace, id, payload)
   *  update(namespace, id)
   * */
  update(namespace, id, payload, _updatedBy) {
    if (typeof namespace !== 'string' || !namespace) return Promise.reject(util.error('DATA.REQUIRED', 'Missing namespace information'));
    if (typeof id === 'object' && arguments.length === 2) {
      payload = id;
      payload.namespace = namespace;
    } else {
      if (typeof payload !== 'object' || !payload) payload = {};
      if (!id) return Promise.reject(util.error('DATA.REQUIRED', 'Missing entry id'));
      payload.id = id;
      payload.namespace = namespace;
      if (typeof _updatedBy !== 'undefined') {
        payload.updated_by = _updatedBy.toString();
      }
    }
    return this.dispatch('entry.update', payload).then((r) => {
      if (!this._payload) return r.result;
      r.payload = payload;
      return r;
    });
  }

  /*
   * Performs a read on an entry via its id.
   * IF no formlet is specified we will not send it.
   * Ways of using:
   *  - read(namespace,formlet,id,filter)
   *  - read(namespace,formlet,id)
   *  - read(namespace,id,filter)
   *  - read(namespace,id)
   * */
  read(namespace, formlet, id, filter) {
    if (typeof namespace !== 'string' || !namespace) return Promise.reject(util.error('DATA.REQUIRED', 'Missing namespace information'));
    let payload;
    if (typeof formlet === 'object' && arguments.length === 2) {
      payload = formlet;
      payload.namespace = namespace;
    } else {
      payload = {
        namespace: namespace
      };
      let _formlet,
        _filter,
        _id;
      // ns,formlet,id,filter
      if (typeof formlet === 'string' && typeof id === 'string' && typeof filter === 'object' && filter) {
        _formlet = formlet;
        _id = id;
        _filter = filter;
      } else if (typeof formlet === 'string' && typeof id === 'string' && typeof filter === 'undefined') {
        // ns,formlet,id
        _formlet = formlet;
        _id = id;
      } else if (typeof formlet === 'string' && typeof id === 'object' && id) {
        // namespace,id,filter
        _id = formlet;
        _filter = id;
      } else if (typeof formlet === 'string' && typeof id === 'undefined') {
        // namespace,id
        _id = formlet;
      }
      if (_filter) {
        Object.keys(_filter).forEach((keyName) => {
          payload[keyName] = _filter[keyName];
        });
      }
      if (!_id) return Promise.reject(util.error('DATA.REQUIRED', 'Missing entry id'));
      payload.id = _id;
      if (_formlet) payload.formlet = _formlet;
    }
    return this.dispatch('entry.read', payload).then((r) => {
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
   *   Ways of using:
   *  find(namespace,formlet(s),payload)
   *  find(namespace,formlet(s))
   *  find(namespace,payload)
   *  find(namespace)
   * */
  find(namespace, formlet, filter) {
    if (typeof namespace !== 'string' || !namespace) return Promise.reject(util.error('DATA.REQUIRED', 'Missing namespace information'));
    let payload = {
      namespace: namespace
    };
    // ns,formlet,payload
    if ((typeof formlet === 'string' || formlet instanceof Array) && typeof filter === 'object' && filter) {
      payload.formlet = formlet;
      Object.keys(filter).forEach((keyName) => payload[keyName] = filter[keyName]);
    } else if ((typeof formlet === 'string' || formlet instanceof Array) && typeof filter === 'undefined') {
      // ns,formlet
      payload.formlet = formlet;
    } else if (typeof formlet === 'object' && formlet) {
      // ns,payload
      payload.formlet = '_all';
      Object.keys(formlet).forEach((keyName) => payload[keyName] = formlet[keyName]);
    }
    return this.dispatch('entry.find', payload).then((r) => {
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
   * Ways of using:
   *  - delete(namespace,id,filter, _deletedBy)
   *  - delete(namespace,id,filter)
   *  - delete(namespace,id,_deletedBy)
   *  - delete(namespace,id)
   * */
  delete(namespace, id, filter, _deletedBy) {
    if (typeof namespace !== 'string' || !namespace) return Promise.reject(util.error('DATA.REQUIRED', 'Missing namespace information'));
    let payload;
    if (typeof id === 'object' && arguments.length === 2) {
      payload = id;
      payload.namespace = namespace;
    } else {
      if (typeof id !== 'string' || !id) return Promise.reject(util.error('DATA.REQUIRED', 'Missing entry id information'));
      payload = {
        namespace: namespace,
        id: id
      };
      if (typeof filter === 'object' && filter) {
        Object.keys(filter).forEach((keyName) => payload[keyName] = filter[keyName]);
      } else if (typeof filter === 'string' || typeof filter === 'number') {
        payload.updated_by = filter;
      }
      if (typeof _deletedBy === 'string' || typeof _deletedBy === 'number') {
        payload.updated_by = _deletedBy;
      }
    }
    return this.dispatch('entry.delete', payload).then((r) => {
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
   * */
  history(namespace, id, filter) {
    if (typeof namespace !== 'string' || !namespace) return Promise.reject(util.error('DATA.REQUIRED', 'Missing namespace information'));
    let payload;
    if (typeof id === 'object' && id && arguments.length === 2) {
      payload = id;
      payload.namespace = namespace;
    } else {
      if (typeof id !== 'string' || !id) return Promise.reject(util.error('DATA.REQUIRED', 'Missing entry id information'));
      let payload = {
        namespace: namespace,
        id: id
      };
      if (typeof filter === 'object' && filter) {
        Object.keys(filter).forEach((keyName) => payload[keyName] = filter[keyName]);
      }
    }
    return this.dispatch('entry.history', payload).then((r) => {
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
      dispatch: this.dispatch.bind(this)
    };
    if (includePayload) {
      ctx._payload = true;
    }
    let wrapper = {
      create: this.create.bind(ctx, ns),
      read: this.read.bind(ctx, ns),
      update: this.update.bind(ctx, ns),
      delete: this.delete.bind(ctx, ns),
      find: this.find.bind(ctx, ns),
      history: this.history.bind(ctx, ns)
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
    return this.dispatch('api.sync', data, {
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
  dispatch(action, payload, _opt) {
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