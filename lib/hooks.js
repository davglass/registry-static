/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var options = require('./args.js');
var hooks = options.hooks;

var defaultHook = wrap(function(options, data, callback) {
    //call the callback, allowing the file to be written
    callback(null, true);
});

function wrap(hook) {
    return function(data, callback, success){
        hook(options, data, function(err, good) {
            if (err) {
                return callback(err);
            }
            if (good) {
                return success();
            }
            return callback();
        });
    };
}

exports.tarball = hooks.tarball ? wrap(hooks.tarball) : defaultHook;
exports.afterTarball = hooks.afterTarball ? wrap(hooks.afterTarball) : defaultHook;
exports.versionJson = hooks.versionJson ? wrap(hooks.versionJson) : defaultHook;
exports.indexJson = hooks.indexJson ? wrap(hooks.indexJson) : defaultHook;
exports.globalIndexJson = hooks.globalIndexJson ? wrap(hooks.globalIndexJson) : defaultHook;
