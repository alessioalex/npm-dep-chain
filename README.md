## npm-dep-chain

### Description

Get the dependency chain for a specified Node module (or a collection of modules). Think of it as a remote `npm ls`.

### API

`getDepChain(package[s], options, callback)`, where:

- the first param is either an object with the properties 'name' and 'version', or a collection of such objects
- options is an object that can have 2 properties: 'filter', a function that will filter packages (see examples below) and 'npmClient' (an instance of [npm-pkginfo](https://github.com/alessioalex/npm-pkginfo) in case you want to provide your custom cache store or specify a custom NPM registry URL)

### Use cases

- custom replication of the NPM registry (only replicate the modules you want)
- statistics / analysis based on the modules used by your application, like finding out all the licences of the dependency chain
or listing all the authors of them
- [`npm ls` like command, but without having the dependencies installed locally](examples/ls-tree.js)
- etc

### Usage

basic example:
```js
/**
* Get all dependencies for multiple versions of Express and NPM latest
*/
var getDepChain = require('npm-dep-chain'),
    util = require('util');

getDepChain([
  {
    name    : 'express',
    version : '3.1.x'
  }, {
    name    : 'express',
    version : '3.4.x'
  }, {
    name    : 'npm',
    version : 'latest'
  }
], function(err, pkgs) {
  if (err) {
    throw err;
  }

  console.log(util.inspect(pkgs, { depth: 2 }));
});
```

using a filter function:
```js
var getDepChain = require('npm-dep-chain'),
    util = require('util');

getDepChain({
  name    : 'express',
  version : '3.1.x'
}, function filter(pkg, cb) {
  // exclude some modules
  if (pkg.name === 'debug' || pkg.name === 'fresh' || /^co/.test(pkg.name)) {
    return cb(null, false);
  }

  cb(null, true);
}, function(err, pkgs) {
  if (err) {
    throw err;
  }

  console.log(util.inspect(pkgs));
});
```

### More examples

Look in the [/examples folder](/examples), there are more complex examples there.

### Motivation

I wanted to create my private NPM registry with custom replication, so I needed to know the dependency tree for a module in order to replicate it (along with all its subdependencies) to that private registry.

### How does it work?

It goes to the NPM registry to get a module's dependencies (or even for more modules), then repeats the dependencies found and so on. It uses a cache (by default stored in __dirname + '/cache') so that if you get the info for a module it won't go to the registry a second time for the same module (but in case there is no compatible version found for the module based on the cached info, it will refresh the cache). For more info, checkout [npm-pkginfo](https://github.com/alessioalex/npm-pkginfo), which is used internally.

### Tests

`npm test`

### License

MIT
