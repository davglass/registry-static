var vows = require('vows'),
    mockery = require('mockery'),
    async = require('async'),
    assert = require('assert');

var options = {hooks:{}};
var hookNames = [
    'tarball',
    'afterTarball',
    'versionJson',
    'indexJson',
    'globalIndexJson'
];
var testError = new Error();

mockery.registerMock('./args.js', options);

function getHooks(overrides) {
    var optHooks = {};
    if (overrides) {
        overrides.forEach(function(name) {
            optHooks[name] = overrideHook;
        });
    }
    options.hooks = optHooks;
    mockery.enable({
        useCleanCache: true,
        warnOnReplace: false,
        warnOnUnregistered: false
    });
    var hooks = require('../lib/hooks');
    mockery.disable();
    return hooks;
}

function overrideHook(opts, data, callback) {
    assert.strictEqual(opts, options);
    if (data === 'err') {
        return callback(testError);
    }
    callback(null, data);
}

function runHooks(overrides, callback) {
    var hooks = getHooks(overrides);
    var fns = hookNames.map(function(name, i){
        var hook = hooks[name];
        assert.equal(typeof hook, 'function');
        if (overrides.indexOf(name) === -1) {
            return function (cb) {
                hook(null, null, cb);
            };
        } else {
            return function (cb) {
                hook(true, null, function(){
                    hook(false, function(){
                        hook('err', function(err){
                            assert.strictEqual(err, testError);
                            cb();
                        });
                    });
                });
            };
        }
    });
    async.parallel(fns, function(err) {
        callback(err);
    });
}

var tests = {};
[
    ['no', []],
    ['all', hookNames],
    ['some', ['tarball', 'versionJson']]
].forEach(function(t){
    tests['when '+t[0]+' hooks overridden'] = {
        topic: function() {
            runHooks(t[1], this.callback);
        },
        'all the hooks work': assert.ifError
    };
});
var tests = {
    'when no hooks overridden': {
        topic: function() {
            runHooks([], this.callback);
        },
        'all the hooks work': assert.ifError
    },
    'when all hooks overridden': {
        topic: function() {
            runHooks(hookNames, this.callback);
        },
        'all the hooks work': assert.ifError
    },
    'when some hooks overridden': {
        topic: function() {
            runHooks(['tarball', 'versionJson'], this.callback);
        },
        'all the hooks work': assert.ifError
    }
};

vows.describe('hooks').addBatch(tests).export(module);
