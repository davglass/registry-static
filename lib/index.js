/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/

require('dnscache')({
    enable: true
});

var follow = require('follow-registry');
var patch = require('patch-package-json');
var files = require('./files.js');
var one = require('./one');
var fs = require('graceful-fs');
var timethat = require('timethat').calc;
var http = require('http-https');
var url = require('url');
var os = require('os');
var hooks = require('./hooks');
var async = require('async');
var miss = require('mississippi');
var once = require('once');
var latestSeq = 'unknown';

var log = require('./logger');
var options = require('./args');
var version = require('../package.json').version;

var GLOBAL_INDEX = '-/index.json';
var NOT_FOUND = '-/404.json';

function readFile(name, cb){
    cb = once(cb);
    var writeStream = miss.concat(function(data){
        cb(null, data.toString());
    });
    miss.pipe(options.blobstore.createReadStream(name), writeStream, function(err) {
        if (err) return cb(err);
    });
}

function writeFile(name, data, cb) {
    options.blobstore.createWriteStream(name, cb).end(data);
}

function updateIndex(data, callback) {
    hooks.globalIndexJson(data, callback, function() {
        readFile(GLOBAL_INDEX, function(err, d) {
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
            return writeFile(GLOBAL_INDEX, JSON.stringify(json, null, 4) + '\n', callback);
        });
    });
}
exports.updateIndex = updateIndex;

//This pauses the feed until callback is executed
function change (data, callback) {
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
    checkForScopedDependencies(data, runBeforeHook);
    function runBeforeHook() {
        hooks.beforeAll(data, callback, runUpdateIndex);
    }
    function runUpdateIndex(){
        exports.updateIndex(data, runSaveTarballs);
    }
    function runSaveTarballs() {
        files.saveTarballs(data.tarballs, runSaveJSON);
    }
    function runSaveJSON() {
        files.saveJSON(data, runUpdateIndexAgain);
    }
    function runUpdateIndexAgain(err) {
        var num = Object.keys(json.versions).length;
        /*istanbul ignore next just a log line with logic*/
        log.info('[' + data.seq + '/' + latestSeq + '] done processing', num, 'version' + ((num > 1) ? 's' : '') + ' of', json.name, 'in', timethat(changeStart));
        exports.updateIndex(data, runAfterAll);
    }
    function runAfterAll() {
        hooks.afterAll(data, callback, callback);
    }
}
exports.change = change;

function checkForScopedDependencies(data, callback) {
    if (!data.json['dist-tags']) {
        return callback();
    }
    var json, scopedModules = [], latestVersion = data.json['dist-tags'].latest;
    data.versions.forEach(function(ver){
        if (ver && ver.json && ver.json.version === latestVersion) {
            json = ver.json;
        }
    });
    if (!json) {
        return callback();
    }
    [
        'dependencies',
        'devDependencies',
        'optionalDependencies'
    ].forEach(function(depType) {
        if (typeof json[depType] !== 'object') {
            return;
        }
        Object.keys(json[depType]).forEach(function(dep){
            if (scopedModules.indexOf(dep) === -1 && /^\@.+\/.+$/.test(dep)) {
                scopedModules.push(dep);
            }
        });
    });
    if (scopedModules.length === 0) {
        return callback();
    }
    async.eachSeries(scopedModules, one, function(){
        // silence errors here since bad scoped deps shouldn't block anything.
        callback();
    });
}

function defaults (opts, callback) {
    if (!callback && typeof opts === 'function') { // for testing
        callback = opts;
        opts = options;
    }
    callback = once(callback);
    function ifErr (e) { if (e) { callback(e); }}
    var error = opts.blobstore.createWriteStream(NOT_FOUND, function(err){
        opts.blobstore.exists(GLOBAL_INDEX, function(err, good) {
            if (err) {
                return callback(err);
            }
            if (good) {
                log.info('skipping index.json since it exists');
                return callback(err);
            }
            var index = opts.blobstore.createWriteStream(GLOBAL_INDEX, callback);
            log.info('Writing index.json');
            miss.pipe(fs.createReadStream(opts.index), index, ifErr);
        });
    });
    log.info('Writing 404.json');
    miss.pipe(fs.createReadStream(opts.error), error, ifErr);
}
exports.defaults = defaults;

function clean (callback) {
    if (!options.clean) {
        return callback();
    }
    var start = new Date();
    log.info('Deleting', options.seqFile);
    fs.unlink(options.seqFile, function() {
        log.warn('finished cleaning in', timethat(start));
        callback();
    });
}
exports.clean = clean;


function setTimer () {
    function timer() {
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
                exports.updateIndex({}, function() {});
            });
        });
    }
    setInterval(timer, ((60 * 5) * 1000));
    timer();
}
exports.setTimer = setTimer;

function run() {
    exports.setTimer();
    var conf = {
        seqFile: options.seqFile,
        handler: change,
        logger: log
    };
    log.info('starting to follow registry with these options:');
    log.info('   domain', options.domain);
    log.info('   directory', options.dir);
    log.info('   tmp', options.tmp);
    log.info('   pid', process.pid);
    if (options.since) {
        log.info('   since', options.since);
        conf.since = options.since;
    }
    follow(conf);
}
exports.run = run;

function start() {
    exports.clean(function() {
        exports.defaults(exports.run);
    });
}
exports.start = start;
