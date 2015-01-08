/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var async = require('async');
var fs = require('graceful-fs');
var mkdirp = require('mkdirp');
var path = require('path');
var options = require('./args.js');
var log = require('davlog');
var verify = require('./verify.js');

var putBall = function(info, callback) {
    var localBall = path.join(options.dir, info.path);
    process.nextTick(function() {
        mkdirp(path.dirname(localBall), function() {
            process.nextTick(function() {
                info.tarball = localBall;
                verify.verify(info, callback);
            });
        });
    });
};

var saveTarballs = function(tarballs, callback) {
    process.nextTick(function() {
        async.eachLimit(tarballs, options.limit, putBall, callback);
    });
};

exports.saveTarballs = saveTarballs;

//Always write it even if it is there.
var putPart = function(info, callback) {
    if (!info.json) {
        return callback();
    }
    var file = path.join(options.dir, info.json.name, info.version, 'index.json');
    process.nextTick(function() {
        mkdirp(path.dirname(file), function() {
            process.nextTick(function() {
                fs.writeFile(file, JSON.stringify(info.json, null, 4) + '\n', callback);
            });
        });
    });
};

//Always write it even if it is there.
var putJSON = function(info, callback) {
    var doc = info.json;
    if (!doc.name || doc.error) {
        return callback(doc.error);
    }
    var file = path.join(options.dir, doc.name, 'index.json');
    log.info('[' + info.seq + '/' + info.latestSeq + ']', 'writing json for', doc.name, 'to', file);
    process.nextTick(function() {
        mkdirp(path.dirname(file), function() {
            process.nextTick(function() {
                fs.writeFile(file, JSON.stringify(doc, null, 4) + '\n', function(err) {
                    if (err) {
                        return putJSON(info, callback);
                    }
                    if (!info.versions || !info.versions.length) {
                        return callback();
                    }
                    process.nextTick(function() {
                        async.eachLimit(info.versions, 5, putPart, callback);
                    });
                });
            });
        });
    });
};

exports.saveJSON = putJSON;
