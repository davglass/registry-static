/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var async = require('async');
var path = require('path');
var options = require('./args.js');
var log = require('./logger');
var verify = require('./verify.js');
var hooks = require('./hooks');

function writeJSONFile(name, data, callback) {
    process.nextTick(function(){
        var stream = options.blobstore.createWriteStream(name, callback);
        stream.write(JSON.stringify(data, null, 4) + '\n');
        stream.end();
    });
}

function putBall(info, callback) {
    info.tarball = path.join(info.path);

    if (!info.tarball.match(/^.*\.tgz/)) {
        // not a real tarball! skip
        return callback();
    }

    hooks.tarball(info, callback, function () {
        process.nextTick(function() {
            verify.verify(info, function (err) {
                if (err) {
                    return callback(err);
                }

                hooks.afterTarball(info, callback, callback);
            });
        });
    });
}

function saveTarballs (tarballs, callback) {
    process.nextTick(function() {
        async.eachLimit(tarballs, options.limit, putBall, callback);
    });
}

exports.saveTarballs = saveTarballs;

//Always write it even if it is there.
function putPart (info, callback) {
    if (!info.json) {
        return callback();
    }
    hooks.versionJson(info, callback, function() {
        writeJSONFile(path.join(info.json.name, info.version, 'index.json'), info.json, callback);
    });
}

//Always write it even if it is there.
function putJSON (info, callback) {
    var doc = info.json;
    if (!doc.name || doc.error) {
        return callback(doc.error);
    }
    var putAllParts = function(err) {
        if (err) {
            return callback(err);
        }
        info.versions.forEach(function(item, key) {
            if (item.json) {
                item.json.name = item.json.name || doc.name;
                info.versions[key] = item;
            }
        });
        async.eachLimit(info.versions, 5, putPart, callback);
    };
    var seq = info.seq;
    var latestSeq = info.latestSeq;
    hooks.indexJson(info, putAllParts, function() {
        var file = path.join(doc.name, 'index.json');
        log.info('[' + seq + '/' + latestSeq + ']', 'writing json for', doc.name, 'to', file);
        writeJSONFile(file, doc, function(err) {
            if (err) {
                return putJSON(info, callback);
            }
            if (!info.versions || !info.versions.length) {
                return callback();
            }
            process.nextTick(putAllParts);
        });
    });
}

exports.saveJSON = putJSON;
