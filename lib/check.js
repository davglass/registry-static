/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var fs = require('graceful-fs'),
    path = require('path'),
    args = require('./args'),
    async = require('async'),
    crypto = require('crypto'),
    url = require('url'),
    log = require('davlog'),
    timethat = require('timethat').calc,
    verify = require('./verify.js').verify,
    options = args();

var check = function(dir, callback) {
    var json = path.join(options.dir, dir, 'index.json');
    fs.readFile(json, 'utf8', function(err, data) {
        if (err) {
            return callback();
        }
        var o = JSON.parse(data);
        if (!o.versions) {
            return callback();
        }
        var tarballs = [];
        Object.keys(o.versions).forEach(function(version) {
            var info = o.versions[version];
            if (info.dist && info.dist.tarball && info.dist.shasum) {
                var u = url.parse(info.dist.tarball);
                tarballs.push({
                    path: u.pathname,
                    tarball: path.join(options.dir, u.pathname),
                    shasum: info.dist.shasum
                });
            }
        });
        if (!tarballs.length) {
            return callback();
        }
        async.eachLimit(tarballs, options.limit, verify, function() {
            callback(null, tarballs);
        });
    });
};

fs.readdir(options.dir, function(err, dirs) {
    var start = new Date();
    async.eachLimit(dirs, options.limit, check, function(err, res) {
        log.info('finished checking tarballs in', timethat(start));
        process.exit(250);
    });
});
