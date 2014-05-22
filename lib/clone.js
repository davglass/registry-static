/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var request = require('request'),
    JSONStream = require('JSONStream'),
    timethat = require('timethat').calc,
    es = require('event-stream'),
    update_seq = 0,
    path = require('path'),
    urlparse = require('url').parse,
    fs = require('graceful-fs'),
    patch = require('patch-package-json'),
    registry = require('follow-registry/lib/registry'),
    files = require('../lib/files'),
    async = require('async'),
    log = require('davlog');

var clone = function(options) {
    if (options.tarballs) {
        return tarballs(options);
    }
    var start = new Date();
    log.info('Doing initial clone of the registry');   
    request.get({
        url: options.registry,
        json: true
    }, function(err, res, json) {
        update_seq = json.update_seq;
        log.info('Fetching module list to clone.. (this may take a bit..)');
        var modules = 0;
        request({
            url: options.registry + '-/all'
        })
            .pipe(JSONStream.parse('*'))
            .pipe(es.map(function(data, callback) {
                //get the complete package.json
                if (!data.name) {
                    return callback();
                }
                    request.get({
                        url: options.registry + data.name,
                        json: true
                    }, function(err, res, body) {
                        if (err || !body || !body.name || !body.versions) {
                            if (err) {
                                log.err(err);
                            }
                            return callback();
                        }
                        modules++;
                        var data = registry.split(body);
                        var json = patch.json(data.json, options.domain);
                        data.versions.forEach(function(item) {
                            item.json = patch.json(item.json, options.domain);
                        });
                        files.saveJSON(data, function() {
                            var num = Object.keys(json.versions).length;
                            log.info('Done processing', num, 'version' + ((num > 1) ? 's' : '') + ' of', json.name);
                            callback(null, json);
                        });
                    });
            }))
            .on('end', function() {
                log.info('Saved JSON for', modules, 'modules in', timethat(start), ', cloning tarballs now...');
                fs.writeFile(options.seqFile, update_seq, 'utf8', function() {
                    tarballs(options);
                });
            });
    });
};


var tarballs = function(options) {
    var count = 0;
    var save = function(name, callback) {
        var json = path.join(options.dir, name, 'index.json');
        log.info('parsing', json, 'for tarball info');
        fs.exists(json, function(good) {
            if (!good) {
                return callback();
            }
            fs.readFile(json, 'utf8', function(err, json) {
                var data;
                if (err) {
                    return callback();
                }
                try {
                    data = JSON.parse(json);
                } catch (e) {
                    log.err('Failed to parse JSON for', name);
                    return callback();
                }
                if (!data.versions) {
                    return callback();
                }
                var balls = [];
                var reg = urlparse(options.registry);
                Object.keys(data.versions).forEach(function(version) {
                    var v = data.versions[version];
                    if (v && v.dist && v.dist.tarball) {
                        balls.push(v.dist.tarball.replace(options.domain, reg.hostname));
                    }
                });
                if (!balls.length) {
                    return callback();
                }
                count += balls.length;
                balls.sort();
                files.saveTarballs(balls, function() {
                    log.info('completed fetching', balls.length,'tarballs for', data.name);
                    callback();
                });
            });
        });
    };
    log.info('fetching all the tarballs');
    var start = new Date();
    fs.readdir(options.dir, function(err, dirs) {
        log.info('scanning', dirs.length, 'directories');
        async.eachLimit(dirs, options.limit, save, function() {
            log.info('finished fetching', count, 'tarballs in', timethat(start));
            log.info('First clone completed, now you can follow as usual..');
        });
    });
};

clone.tarballs = tarballs;

module.exports = clone;
