var vows = require('vows'),
    mockery = require('mockery'),
    async = require('async'),
    assert = require('assert');

var options = {hooks:{}};
var davlog = {};
var hookNames = [
    'beforeAll',
    'afterAll',
    'tarball',
    'afterTarball',
    'versionJson',
    'indexJson',
    'globalIndexJson',
    'startup'
];
var testError = new Error();


function getHooks(overrides) {
    var optHooks = {};
    if (overrides) {
        overrides.forEach(function(name) {
            optHooks[name] = overrideHook;
        });
    }
    options.hooks = optHooks;
    mockery.registerMock('./args.js', options);
    mockery.registerMock('davlog', davlog);
    mockery.enable({
        useCleanCache: true,
        warnOnReplace: false,
        warnOnUnregistered: false
    });
    var hooks = require('../lib/hooks');
    mockery.disable();
    return hooks;
}

function overrideHook(data, callback) {
    assert.strictEqual(this.options, options);
    assert.strictEqual(this.log, davlog);
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
