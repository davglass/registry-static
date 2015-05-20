/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var options = require('./args.js');
var log = require('davlog');
var hooks = options.hooks;

var hookContext = {
    options: options,
    log: log
};

function defaultHook(data, callback, success) {
    //call the success callback, allowing the file to be written
    success();
}

function wrap(hookName) {
    return function wrapped(data, callback, success){
        hooks[hookName].call(hookContext, data, function(err, good) {
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

exports.beforeAll = hooks.hasOwnProperty('beforeAll') ? wrap('beforeAll') : defaultHook;
exports.afterAll = hooks.hasOwnProperty('afterAll') ? wrap('afterAll') : defaultHook;
exports.tarball = hooks.hasOwnProperty('tarball') ? wrap('tarball') : defaultHook;
exports.afterTarball = hooks.hasOwnProperty('afterTarball') ? wrap('afterTarball') : defaultHook;
exports.versionJson = hooks.hasOwnProperty('versionJson') ? wrap('versionJson') : defaultHook;
exports.indexJson = hooks.hasOwnProperty('indexJson') ? wrap('indexJson') : defaultHook;
exports.globalIndexJson = hooks.hasOwnProperty('globalIndexJson') ? wrap('globalIndexJson') : defaultHook;
exports.startup = hooks.hasOwnProperty('startup') ? wrap('startup') : defaultHook;
