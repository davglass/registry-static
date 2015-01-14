/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var options = require('./args.js');

var hookNames = [
    'tarball',
    'afterTarball',
    'versionJson',
    'indexJson',
    'globalIndexJson'
];

var defaultHooks = {};
hookNames.forEach(function(name) {
    defaultHooks[name] = function (options, data, callback) {
        //call the callback, allowing the file to be written
        callback(null, true);
    };
});

var hooks = options.hooks;

var wrappedHooks = {};

hookNames.forEach(function(name) {
    var hook = options.hooks[name] || defaultHooks[name];
    wrappedHooks[name] = function (data, callback, success){
        hook(options, data, function (err, good) {
            if (err) {
                return callback(err);
            }
            if (good) {
                return success();
            }
            return callback();
        });
    };
});

module.exports = wrappedHooks;
