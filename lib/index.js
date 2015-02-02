/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var follow = require('follow-registry');
var patch = require('patch-package-json');
var files = require('./files.js');
var path = require('path');
var fs = require('graceful-fs');
var mkdirp = require('mkdirp');
var timethat = require('timethat').calc;
var http = require('http-https');
var url = require('url');
var os = require('os');
var hooks = require('./hooks');

var logger = require('./logger');
logger();

var log = require('davlog');
var options = require('./args');
var version = require('../package.json').version;

if (options.version) {
    console.log(version);
    process.exit(250);
}

var updateIndex = function(data, callback) {
    hooks.globalIndexJson(data, callback, function() {
        var index = path.join(options.dir, 'index.json');
        fs.readFile(index, 'utf8', function(err, d) {
            var json;
            try {
                //sometimes the json can get corrupted or missing, this catches that
                json = JSON.parse(d);
            } catch (e) {
                json = {};
            }
            json.domain = options.domain;
            if (data)  {
                if (data.json && data.json.name) {
                    json.processing = data.json.name;
                }
                json.sequence = data.seq;
            }
            //This is for nagios checking..
            json.couchdb = 'Welcome';
            json.pid = process.pid;
            json.parentPid = Number(process.env.PARENT_PID);
            json.version = version;
            json.dir = options.dir;
            json.uptime = timethat(new Date(), new Date(Date.now() + (process.uptime() * 1000)));
            json.node = process.version;
            json.latestSeq = latestSeq;
            json.stamp = Date.now();
            json.date = new Date();
            json.hostname = os.hostname();
            var o = {};
            Object.keys(json).sort().forEach(function(key) {
                o[key] = json[key];
            });
            json = o;
            return fs.writeFile(index, JSON.stringify(json, null, 4) + '\n', 'utf8', callback);
        });
    });
};

//This pauses the feed until callback is executed
var change = function(data, callback) {
    var changeStart = new Date();
    var json;
    try {
        json = patch.json(data.json, options.domain);
    } catch (e) {
        if (e instanceof SyntaxError) {
            //Bad json. Just bail.
            return callback();
        } else {
            throw e;
        }
    }
    if (!json.name) {
        //Bail, something is wrong with this change
        return callback();
    }
    //Just to make sure that the value is cast to a Number
    data.seq = Number(data.seq);
    latestSeq = Number(latestSeq);
    if (data.seq > latestSeq) {
        latestSeq = data.seq;
    }
    data.latestSeq = latestSeq;
    log.info('[' + data.seq + '/' + latestSeq + '] processing', json.name);
    if (!data.versions.length) {
        return callback();
    }
    data.versions.forEach(function(item) {
        item.json = patch.json(item.json, options.domain);
    });
    updateIndex(data, function() {
        files.saveTarballs(data.tarballs, function() {
            files.saveJSON(data, function(err) {
                if (err) {
                    log.err(err);
                    return callback();
                }
                var num = Object.keys(json.versions).length;
                log.info('[' + data.seq + '/' + latestSeq + '] done processing', num, 'version' + ((num > 1) ? 's' : '') + ' of', json.name, 'in', timethat(changeStart));
                updateIndex(data, function() {
                    callback();
                });
            });
        });
    });
};

var defaults = function(callback) {
    mkdirp(options.dir, function() {
        var error = fs.createWriteStream(path.join(options.dir, '404.json'));
        log.info('Writing 404.json');
        fs.createReadStream(options.error)
            .on('end', function() {
                var indexOut = path.join(options.dir, 'index.json');
                fs.exists(indexOut, function(good) {
                    if (good) {
                        log.info('skipping index.json since it exists');
                        return callback();
                    }
                    var index = fs.createWriteStream(indexOut);
                    log.info('Writing index.json');
                    fs.createReadStream(options.index)
                        .on('end', callback)
                        .pipe(index);
                });
            })
            .pipe(error);
    });
};

var clean = function(callback) {
    if (!options.clean) {
        return callback();
    }
    var start = new Date();
    log.info('Deleting', options.seqFile);
    fs.unlink(options.seqFile, function() {
        log.warn('finished cleaning in', timethat(start));
        callback();
    });
};

var latestSeq = 'unknown';

var setTimer = function() {
    var timer = function() {
        var u = url.parse('https://skimdb.npmjs.com/registry');
        u.headers = {
            'user-agent': 'registry static mirror worker'
        };
        http.get(u, function(res) {
            var d = '';
            res.on('data', function(data) {
                d += data;
            });
            res.on('end', function() {
                var json = JSON.parse(d);
                latestSeq = json.update_seq;
                log.info('latest sequence', latestSeq);
                updateIndex({ seq: latestSeq }, function() {});
            });
        });
    };
    setInterval(timer, ((60 * 5) * 1000));
    timer();
};

var start = function() {
    clean(function() {
        defaults(function() {
            setTimer();
            if (options.clone) {
                var clone = require('./clone.js');
                clone(options);
                return;
            }
            var conf = {
                seqFile: options.seqFile,
                handler: change
            };
            log.info('[' + process.env.PROC_SPAWN + '] starting to follow registry with these options:');
            log.info('   domain', options.domain);
            log.info('   directory', options.dir);
            log.info('   tmp', options.tmp);
            log.info('   pid', process.pid);
            if (options.since) {
                log.info('   since', options.since);
                conf.since = options.since;
            }
            follow(conf);
        });
    });
};

module.exports = start;
