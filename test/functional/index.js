"use strict";

var http      = require('http'),
    net       = require('net'),
    os        = require('os'),
    xtend     = require('xtend'),
    assert    = require('assert'),
    getDeps   = require('../../'),
    semver    = require('semver'),
    RegClient = require('npm-pkginfo'),
    packages  = require('../fixtures/npm.json'),
    after     = require('after'),
    next;

next = after(3, function() {
  console.log('All tests passed.');
  process.exit();
});

var portrange = 45032;

function getPort(cb) {
  var port = portrange;
  portrange += 1;

  var server = net.createServer();
  server.listen(port, function (err) {
    server.once('close', function () {
      cb(port);
    });
    server.close();
  })
  server.on('error', function (err) {
    getPort(cb);
  })
}

getPort(function(port) {
  var npmClient, requested;

  requested = {};

  http.createServer(function(req, res) {
    var packageName, latestVersion, tmp;

    if (req.url === '/favicon.ico') {
      res.writeHead(404, {'Content-Type': 'text/html'});
      res.end();
    } else {
      packageName = req.url.slice(1);

      if (!packages[packageName]) {
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          error  : "not_found",
          reason : "document not found"
        }));
      } else {
        // track down how many times a package has been requested
        if (!requested[packageName]) {
          requested[packageName] = 1;
        } else {
          requested[packageName] += 1;
        }

        res.writeHead(200, {'Content-Type': 'application/json'});
        latestVersion = semver.maxSatisfying(Object.keys(packages[packageName]), '*');
        res.end(JSON.stringify(xtend({
          name        : packages[packageName][latestVersion].name,
          description : packages[packageName][latestVersion].description,
          'dist-tags' : {
            stable: latestVersion,
            latest: latestVersion
          }
        }, {
          versions: packages[packageName]
        })));
      }
    }
  }).listen(port);

  npmClient = new RegClient({
    REGISTRY_URL : 'http://127.0.0.1:' + port,
    cacheDir     : os.tmpDir() + '/' + Math.random().toString(16).slice(2)
  });

  getDeps({ name: 'abc' }, { npmClient: npmClient }, function(err, chain) {
    assert.throws(err, 'must throw error if module not found');
    next();
  });

  getDeps({ name: 'npm' }, { npmClient: npmClient }, function(err, chain) {
    var chainPkgs, originalPkgs;

    assert.ifError(err);
    next();

    chainPkgs    = Object.keys(chain).sort();
    originalPkgs = Object.keys(packages).sort();

    assert.deepEqual(chainPkgs, originalPkgs, 'must go down the dep chain');
    next();
  });

});
