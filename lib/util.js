'use strict';
/**
 * Utility function
 */
const util = {},
  fetch = require("node-fetch-abort");

/*
 * Error convertor
 * */
util.error = (code, message, status) => {
  let e;
  if (code instanceof Error) {
    e = code;
    e.code = message;
  } else {
    e = new Error(message || 'An unexpected error occurred');
    e.code = code || 'GLOBAL.ERROR';
  }
  if (typeof status === 'number' || typeof status === 'string') e.statusCode = parseInt(status, 10);
  return e;
};


module.exports = util;
