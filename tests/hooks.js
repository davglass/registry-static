var mockery = require('mockery'),
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
    'startup',
    'shasumCheck'
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
    mockery.registerMock('./args', options);
    mockery.registerMock('./logger', davlog);
    mockery.registerMock('./defaultShasumCheck', function(data, callback){
        callback(null, true);
    });
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

describe('hooks', function(){
    it('when no hooks overridden, all the hooks work', function(done){
        runHooks([], done);
    });

    it('when all hooks overridden, all the hooks work', function(done){
        runHooks(hookNames, done);
    });

    it('when some hooks overridden, all the hooks work', function(done){
        runHooks(['tarball', 'versionJson'], done);
    });
});
