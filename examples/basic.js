"use strict";

/**
 * Basic example that returns all the deps
 * for Express 3.1.x
 */
var getDeps = require('../'),
    util    = require('util');

getDeps({
  name    : 'express',
  version : '3.1.x'
}, function(err, deps) {
  if (err) {
    throw err;
  }

  // this will output an array with the NPM modules required
  // replace 1 with 5 to see every sub object / property
  console.log(util.inspect(deps, { depth: 1 }));
});
