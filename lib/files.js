/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var url = require('url');
var async = require('async');
var request = require('request');
var fs = require('graceful-fs');
var mkdirp = require('mkdirp');
var path = require('path');
var args = require('./args.js');
var options = args();
var exec = require('child_process').execFile;
var log = require('davlog');
var head = function(file, callback) {
    var f = path.join(options.dir, file);
    process.nextTick(function() {
        fs.exists(f, callback);
    });
};
var verify = require('./verify.js');

exports.head = head;

var putBall = function(info, callback) {
    var type = 'application/octet-stream';
    var ball = info.tarball;
    var localBall = path.join(options.dir, info.path);
    head(info.path, function(good) {
        if (good) {
            //log.info('skipping download for', localBall, ', exists on disk');
            //return callback(null, localBall);
        }
        process.nextTick(function() {
            mkdirp(path.dirname(localBall), function() {
                process.nextTick(function() {
                    info.tarball = localBall;
                    verify.update(info, callback);
                });
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
    log.info('Writing json for', doc.name, 'to', file);
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
