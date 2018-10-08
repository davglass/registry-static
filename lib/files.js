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
var miss = require('mississippi');
var once = require('once');

process.registryStaticStats = {};

function writeJSONFile(name, data, callback) {
    setImmediate(function(){
        options.blobstore.createWriteStream(name, callback)
        .end(JSON.stringify(data, null, 4) + '\n');
    });
}

function readJSONFile(name, callback) {
    callback = once(callback);
    miss.pipe(options.blobstore.createReadStream(name), miss.concat(function(data){
        try {
            callback(null, JSON.parse(data.toString()));
        } catch (error) {
            callback(error);
        }
    }), function(err){
        if (err) { callback(err); }
    });
}

// Merge the new doc with the old doc, making sure not to delete older versions.
function newDoc(doc, callback) {
    // NOTE: in here we're swallowing all the errors.
    // If anything fails, we want to just use the new Doc from the update as is.
    var file = path.join(doc.name, 'index.json');
    if (!doc.versions) {
        // bad data. still don't want to lose old versions, so set this.
        doc.versions = {};
    }
    options.blobstore.exists(file, function(err, exists) {
        if (err || !exists) { return callback(null, doc); }
        readJSONFile(file, function(err, oldDoc){
            if (err || !oldDoc) { return callback(null, doc); }
            Object.keys(oldDoc.versions || {}).forEach(function(version){
                if (!doc.versions[version]) {
                    doc.versions[version] = oldDoc.versions[version];
                }
            });
            callback(null, doc);
        });
    });
}

function putBall(info, callback) {
    info.tarball = path.join(info.path);

    if (!info.tarball.match(/^.*\.tgz/)) {
        // not a real tarball! skip
        return callback();
    }

    hooks.tarball(info, callback, function () {
        setImmediate(function() {
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
    async.eachLimit(tarballs, options.limit, putBall, callback);
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
    newDoc(doc, function(err, doc) {
        var seq = info.seq;
        var latestSeq = info.latestSeq;
        process.registryStaticStats.seq = seq;
        process.registryStaticStats.latestSeq = latestSeq;
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
                setImmediate(putAllParts);
            });
        });
    });
}

exports.saveJSON = putJSON;
