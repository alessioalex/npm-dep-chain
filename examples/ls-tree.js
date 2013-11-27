"use strict";

/**
 * Kind of like `npm ls`, but for an NPM module instead of your app
 * (you don't need the dependencies installed locally)
 */

var getDeps = require('../'),
    treeify = require('treeify'),
    semver  = require('semver'),
    tmp, pkg;

if (!process.argv[2]) {
  tmp  = 'You must pass in the module argument. Usage: \n\n';
  tmp += '    node ls-tree.js express@latest \n';
  tmp += '    node ls-tree.js connect@2.0.x \n';
  tmp += '    node ls-tree.js level\n';

  console.error(tmp);
  process.exit(1);
} else {
  tmp = process.argv[2].split('@');
  pkg = {
    name    : tmp[0],
    version : tmp[1] || '*'
  };
}

getDeps(pkg, function(err, deps) {
  var tree;

  if (err) {
    throw err;
  }

  tree = getTree(pkg, deps);

  console.log(treeify.asTree(tree));
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
