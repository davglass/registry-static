/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var fs = require('fs'),
    http = require('http-https'),
    path = require('path'),
    args = require('./args'),
    crypto = require('crypto'),
    mkdirp = require('mkdirp'),
    timethat = require('timethat').calc,
    url = require('url'),
    uparse = url.parse;
    log = require('davlog'),
    pretty = require('prettysize'),
    options = args();

var counter = {};

var update = function(info, callback) {
    var url = options.registry + info.path.substring(1);
    mkdirp(path.dirname(info.tarball), function() {
        var callbackDone = false;
        process.nextTick(function() {
            var writer = fs.createWriteStream(info.tarball);
            counter[info.path] = counter[info.path] || 0;
            counter[info.path]++;
            log.info('[' + counter[info.path] + '] downloading', url);
            var startDL = new Date();
            var req = http.get(uparse(url))
                .on('error', function(e) {
                    callbackDone = true;
                    req.end();
                    log.err(' [' + counter[info.path] + '] failed to download', info.tarball);
                    delete counter[info.path];
                    return callback(new Error('failed to download ' + info.tarball));
                })
                .on('response', function(res) {
                    log.info('[' + counter[info.path] + ']', info.path, 'is', pretty(res.headers['content-length']));
                    res.on('end', function() {
                        if (callbackDone) {
                            return;
                        }
                        log.info('[' + counter[info.path] + '] finished downloading', url, 'in', timethat(startDL));
                        process.nextTick(function() {
                            verify(info, callback);
                        });
                    })
                        .pipe(writer);
                })
        });
    });
};

exports.update = update;

var verify = function(info, callback) {
    counter[info.path] = counter[info.path] || 0;
    process.nextTick(function() {
        fs.exists(info.tarball, function(good) {
            if (!good) {
                return update(info, callback);
            }
            if (counter[info.path] >= 4) {
                log.err(' [' + counter[info.path] + '] file appears to be corrupt, skipping..', info.tarball);
                delete counter[info.path];
                //bail, the tarball is corrupt
                return callback(null, info);
            }
            log.info('[' + counter[info.path] + '] checking shasum of', info.tarball);
            process.nextTick(function() {
                var shasum = crypto.createHash('sha1');
                shasum.setEncoding('hex');
                fs.createReadStream(info.tarball)
                    .on('end', function() {
                        shasum.end();
                        var d = shasum.read();
                        if (info.shasum !== d) {
                            log.err(' [' + counter[info.path] + '] shasum check failed for', info.path);
                            log.err(' [' + counter[info.path] + '] found', d, 'expected', info.shasum);
                            return update(info, callback);
                        }
                        log.info('[' + counter[info.path] + '] shasum check passed for', info.path, '(' + info.shasum + ')');
                        delete counter[info.path];
                        callback(null, info);
                    })
                    .pipe(shasum);
                });
        });
    });
};

exports.verify = verify;
