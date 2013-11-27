"use strict";

/**
 * Exactly like `npm ls` for your project, but the difference is
 * that you don't need to have the deps installed locally
 */

var getDeps = require('../'),
    treeify = require('treeify'),
    semver  = require('semver'),
    readPkg = require('read-package-json'),
    util    = require('util'),
    PATH_TO_PACKAGE_JSON = __dirname + '/package.json',
    tmp, pkg;


readPkg(PATH_TO_PACKAGE_JSON, function(err, data) {
  var _deps = [];

  if (err) { throw err; }

  if (data.dependencies) {
    Object.keys(data.dependencies).forEach(function(dep) {
      _deps.push({
        name    : dep,
        version : data.dependencies[dep]
      });
    });
  }

  getDeps(_deps, function(err, deps) {
    var tree;

    if (err) {
      throw err;
    }

    // deps should contain all the dependencies data, including the root
    // because of the logic in populateItem()
    deps[data.name] = {};
    deps[data.name][data.version] = data;

    tree = getTree(data, deps);

    console.log(treeify.asTree(tree));
  });
});

/**
 * Returns the dependency tree for a NPM module
 */
function getTree(root, deps) {
  var tree;

  tree = {};

  populateItem(tree, root, deps);

  return tree;
}

/**
 * Traverses the node (module) and the subnodes (module dependencies)
 */
function populateItem(subtree, root, deps) {
  var version, directDeps;

  // dependency missing from the registry ?!
  if (root.name && (typeof deps[root.name] === 'undefined')) {
    subtree[root.name + '@MISSING_FROM_REGISTRY'] = {};
    return;
  }

  version = semver.maxSatisfying(Object.keys(deps[root.name]), root.version);

  subtree[root.name + '@' + version] = {};

  directDeps = deps[root.name][version].dependencies || {};

  Object.keys(directDeps).forEach(function(name) {
    var _dep;

    _dep = {
      name    : name,
      version : directDeps[name]
    };

    populateItem(subtree[root.name + '@' + version], _dep, deps);
  });
}
