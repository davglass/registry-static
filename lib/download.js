#!/usr/bin/env node
/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var request = require('request');
var fs = require('graceful-fs');
var mkdirp = require('mkdirp');
var path = require('path');
var url = require('url');

var argv = process.argv;
var ball = argv[2];
var localBall = argv[3];

mkdirp(path.dirname(localBall), function() {
    var u = url.parse(ball);
    console.log('saving', u.pathname);
    var writer = fs.createWriteStream(localBall);
    request.get({
        url: ball
    })
        .on('end', function() {
            console.log('done with', u.pathname);
            process.nextTick(function() {
                process.exit(0);
            });
        })
        .on('error', function() {
            process.nextTick(function() {
                process.exit(1);
            });
        })
        .pipe(writer)
});
