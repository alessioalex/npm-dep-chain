"use strict";

/**
* List the module used by express along with their description
 */
var getDeps = require('../'),
    util    = require('util'),
    semver  = require('semver');

getDeps({
  name    : 'express',
  version : '3.1.x'
}, function(err, deps) {
  if (err) {
    throw err;
  }

  Object.keys(deps).forEach(function(dep) {
    var versions, latest, pkg;

    // get versions array for a module
    versions = Object.keys(deps[dep]);
    latest   = semver.maxSatisfying(versions, '*');

    pkg = deps[dep][latest];

    // module name
    console.log(dep);
    console.log('----');
    // module description
    console.log(pkg.description || 'no description provided');
    console.log('\n');
  });

});
