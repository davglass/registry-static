/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var fs = require('graceful-fs'),
    path = require('path'),
    options = require('./args'),
    async = require('async'),
    url = require('url'),
    log = require('davlog'),
    timethat = require('timethat').calc,
    verify = require('./verify.js').verify,
    util = require('./util');

//kill the info logging on check
//only warn and err should be printed.
log.quiet();

var check = function(dir, callback) {
    var json = path.join(options.dir, dir, 'index.json');
    fs.readFile(json, 'utf8', function(err, data) {
        if (err) {
            return callback();
        }
        var o = JSON.parse(data);
        util.check(o, options, callback);
    });
};
fs.readdir(options.dir, function(err, dirs) {
    var start = new Date();
    async.eachLimit(dirs, options.limit, check, function() {
        console.log('finished checking tarballs in', timethat(start));
        if (options.report) {
            var report = require('./verify.js').report();
            console.log('writing report to', options.report);
            fs.writeFile(options.report, JSON.stringify(report, null, 4) + '\n', 'utf8', function() {
                process.exit(250);
            });
        } else {
            process.exit(250);
        }
    });
});
