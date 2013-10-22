"use strict";

var semver       = require('semver'),
    after        = require('after'),
    once         = require('once'),
    util         = require('util'),
    errTo        = require('errto'),
    RegClient    = require('npm-pkginfo'),
    defaultNpmClient, noop;

noop = function() {};
defaultNpmClient = new RegClient({
  cacheDir: __dirname + '/cache'
});

/**
 * Fetches data from the NPM registry for a package based on its name and version range.
 * It will find the maximum version that satisfies the range.
 *
 * @param {Object} pkg - contains version and name of the package
 * @param {Object} npmClient - instance of npm-pkginfo
 * @param {Function} callback
 */
function getNpmData(pkg, npmClient, callback) {

  callback = once(callback);

  // default to latest version
  if (!pkg.version || pkg.version === 'latest') {
    pkg.version = '*';
  }

  npmClient.get(pkg.name, { staleOk: true }, errTo(callback, function(npmPackageInfo) {
    var version;

    version = semver.maxSatisfying(Object.keys(npmPackageInfo.versions), pkg.version);

    // if the version is not found, perhaps the cache is old, force load from registry
    if (!version) {
      npmClient.get(pkg.name, { staleOk: true }, errTo(callback, function(npmPackageInfo) {
        callback(null, npmPackageInfo.versions[version] || null);
      }));
    } else {
      callback(null, npmPackageInfo.versions[version] || null);
    }
  }));
};

/**
 * Fetches data from the NPM registry for all the packages provided.
 *
 * @param {Array} pkgs - an array of packages objects containing the name && version props
 * @param {Object} collection - collection of processed packages
 * @param {Object} npmClient - instance of npm-registry-client
 * @param {Function} callback
 */
function getBulkNpmData(pkgs, collection, npmClient, callback) {
  var next, results;

  results = [];
  next    = after(pkgs.length, callback);

  pkgs.forEach(function(pkg) {
    // make sure not to make unnecessary queries to the registry
    if (isDuplicate(collection[pkg.name], pkg.version)) {
      return next(null);
    }

    getNpmData(pkg, npmClient, errTo(callback, function(found) {
      results.push(found);

      next(null, results);
    }));
  });
};

/**
 * Map the dependencies object to an array containing name && value properties.
 *
 * @param {Object} dependencies
 * @returns {Array}
 */
function mapDependencies(dependencies) {
  var deps;

  deps = (dependencies) ? Object.keys(dependencies) : [];

  return deps.map(function(name) {
    return {
      name: name,
      version: dependencies[name]
    };
  });
};

/**
 * Check if a version of a package already exists
 *
 * @param {Object} pkg - an object with the keys representing the versions of a module
 * @param {String} version - version range
 * @returns {Array}
 */
// TODO: refactor this, first arg should be versions instead
function isDuplicate(pkg, version) {
  var versions;

  // no duplicates
  if (pkg) {
    versions = Object.keys(pkg);

    if (versions.length && semver.maxSatisfying(versions, version)) {
      return true;
    }
  }

  return false;
};

/**
 * Add the package:version pair to the packages object if the package doesn't exist
 * or the version doesn't exist.
 *
 * @param {Object} packages - keys represent package names, subkeys represent versions
 * @param {String} packageInfo - data retrieved from the NPM registry for a package
 */
function addPackage(packages, packageInfo) {
  var temp, name, version;

  name    = packageInfo.name;
  version = packageInfo.version;

  if (!packages[name]) {
    temp = {};
    temp[version] = packageInfo;

    packages[name] = temp;
  } else {
    // no duplicates
    if (!isDuplicate(packages[name], version)) {
      packages[name][version] = packageInfo;
    }
  }
};

/**
 * Add the package to the queue in case the name && version doen't exist or
 * the version range isn't matched.
 *
 * @param {Object} queue - contains packages info from NPM registry
 * @param {String} packageInfo - data retrieved from the NPM registry for a package
 */
function addToQueue(queue, packageInfo) {
  var exists;

  function matchesVersion(version, range) {
    var matches;

    try {
      matches = semver.satisfies(packageInfo.version, item.version);
    }
    catch (err) {
      matches = false;
    }

    return matches;
  }

  exists = queue.some(function(item) {
    var matches = false;

    if (item.name === packageInfo.name) {
      matches = matchesVersion(packageInfo.version, item.version);
    }

    return matches;
  });

  if (!exists) {
    queue.push(packageInfo);
  }
};

/**
 * Filters the packages using an async function that gets called with
 * the packageInfo && callback params. The callback takes two arguments:
 * an error param and a boolean value (condition matched or not)
 *
 * @param {Object} packages - contains packages info from NPM registry
 * @param {Function} filterFn
 * @param {Function} callback
 */
function filterPackages(packages, filterFn, callback) {
  var results, next;

  results = [];
  next    = after(packages.length, function(err) {
    // the final callback gets called after all the functions have been executed
    callback(err, results);
  });

  packages.forEach(function(packageInfo) {
    filterFn(packageInfo, function(err, ok) {
      if (!err && ok) {
        results.push(packageInfo);
      }

      next(err);
    });
  });
};

/**
 * Add the packages to the "results" collection and add their direct
 * dependencies to the `queue` so they can be processed later. When all done,
 * invoke callback.
 *
 * @param {Object} queue
 * @param {Object} collection
 * @param {Function} callback
 */
function processDeps(queue, collection, callback, errBack) {
  return errTo(errBack, function(packages) {
    var deps;

    packages.forEach(function(pkg) {
      // add the package to the collection of processed packages
      addPackage(collection, pkg);

      // if the module has dependencies, add them to the processing queue
      // unless they have been already processed
      mapDependencies(pkg.dependencies).forEach(function(dep) {
        if (!isDuplicate(collection[dep.name], dep.version)) {
          addToQueue(queue, dep);
        }
      });
    });

    callback(queue);
  });
};

/**
 * "Main" function
 *
 * @param {Object/Array} pkg
 * @param {Object} opts - optional, props: filter, npmClient
 * @param {Function} callback
 */
function getDepChain(pkg, opts, callback) {
  var pkgs, queue, npmClient;

  if (!callback) {
    callback = opts;
    opts = {};
  }

  callback  = once(callback);
  pkgs      = {};
  queue     = util.isArray(pkg) ? pkg : [pkg];
  npmClient = opts.npmClient || defaultNpmClient;

  (function iterate(queue) {
    var iterator;

    if (queue.length) {
      // copy the items in the queue and then reset it
      iterator = queue;
      queue = [];
    } else {
      // if the queue is empty it means we've processed everything
      return callback(null, pkgs);
    }

    if (opts.filter) {
      filterPackages(iterator, opts.filter, errTo(callback, function(filteredPkgs) {
        getBulkNpmData(filteredPkgs, pkgs, npmClient, processDeps(queue, pkgs, iterate, callback));
      }));
    } else {
      getBulkNpmData(iterator, pkgs, npmClient, processDeps(queue, pkgs, iterate, callback));
    }

  }(queue));
};

module.exports = getDepChain;
