/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var options = require('./args.js');

var hookNames = [
    'tarball',
    'versionJson',
    'indexJson',
    'globalIndexJson'
];

var defaultHooks = {};
hookNames.forEach(function(name) {
    defaultHooks[name] = function () {
        //call the callback, allowing the file to be written
        arguments[arguments.length - 1](null, true);
    };
});

var hooks = options.hooks;

var wrappedHooks = {};

hookNames.forEach(function(name) {
    var hook = options.hooks[name] || defaultHooks[name];
    wrappedHooks[name] = function (data, callback, success){
        hook(data, function (err, good) {
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
