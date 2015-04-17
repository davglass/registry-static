var vows = require('vows'),
    assert = require('assert'),
    mockery = require('mockery'),
    crypto = require('crypto'),
    fs = require('fs'),
    http = require('http-https'),
    createReadStream = fs.createReadStream,
    createWriteStream = fs.createWriteStream;

function noop () {}

var memblob = require('abstract-blob-store')();

function setupMocks(log, badRegistry) {
    log = log || [];
    memblob.data = {'existing.tgz': 'asdf'};
    mockery.resetCache();
    mockery.registerMock('./args', {
        get registry() {
            return badRegistry ? 'http://fhgidygfi' : 'http://registry.npmjs.org';
        },
        blobstore: memblob
    });
    mockery.registerMock('davlog', {
        init: noop,
        info: noop,
        warn: noop,
        err: function(msg, file) {
            log.push([].slice.call(arguments).join(' '));
        }
    });
    mockery.enable({
        useCleanCache: true,
        warnOnReplace: false,
        warnOnUnregistered: false
    });
    verify = require('../lib/verify');
    cacheVerify = verify.verify;
    cacheUpdate = verify.update;
}

function stubUpdate() {
    verify.verify = cacheVerify;
    verify.update = function(info, callback) {
        info.updateCalled = true;
        callback(null, info);
    };
}

function stubVerify() {
    verify.update = cacheUpdate;
    verify.verify = function(info, callback) {
        info.verifyCalled = true;
        callback(null, info);
    };
}

var verify;
var cacheUpdate;
var cacheVerify;
var thisFileHash;

var tests = {
    'should export': {
        topic: function() {
            setupMocks();
            verify = require('../lib/verify');
            return verify;
        },
        'an object': function(d) {
            assert.isObject(d);
        },
        'with methods': function(d) {
            ['verify', 'update', 'report', 'counter'].forEach(function(name) {
                assert.isFunction(d[name]);
            });
        },
    },
    'update method': {
        'downloads the file': {
            topic: function() {
                var log = [];
                setupMocks(log);
                stubVerify();
                var callback = this.callback;
                var info = {
                    path: '//registry-static/-/registry-static-0.1.11.tgz',
                    tarball: 'registry-static-0.1.11.tgz'
                };
                verify.update(info, function(err) {
                    callback(err, {log: log, info: info});
                });
            },
            'and then calls verify': function(d) {
                assert.equal(d.log.length, 0);
                assert.equal(d.info.http, 200);
                assert(d.info.verifyCalled);
            }
        },
        'tries to download with bad server': {
            topic: function() {
                var log = [];
                setupMocks(log, true);
                stubVerify();
                var callback = this.callback;
                var info = {
                    path: '//async/-/async-0.9.0.tgz',
                    tarball: 'async-0.9.0.tgz'
                };
                verify.update(info, function(err) {
                    badRegistry = false;
                    callback(null, {err: err, log: log});
                });
            },
            'calls back with an error': function(d) {
                assert.deepEqual(d.log, [' [1] failed to download async-0.9.0.tgz']);
                assert.equal(d.err.message, 'failed to download async-0.9.0.tgz');
            }
        },
        'tries to download with a 404 file': {
            topic: function() {
                var log = [];
                setupMocks(log);
                stubVerify();
                var callback = this.callback;
                var info = {
                    path: '//foobarbaz.tgz',
                    tarball: 'foo-1.0.0.tgz'
                };
                verify.update(info, function(err) {
                    callback(null, {err: err, log: log});
                });
            },
            'calls back with an error': function(d) {
                assert.deepEqual(d.log, [' [1] failed to download with a 404 foo-1.0.0.tgz']);
                assert.equal(d.err.message, 'failed to download foo-1.0.0.tgz');
            }
        },
        teardown: function() {
            mockery.disable();
        }
    },
    'verify method': {
        topic: function() {
            var callback = this.callback;
            var shasum = crypto.createHash('sha1');
            shasum.setEncoding('hex');
            fs.createReadStream(__filename)
                .on('end', function(){
                    shasum.end();
                    thisFileHash = shasum.read();
                    callback();
                })
            .pipe(shasum);
        },
        'checks hash': {
            topic: function (){
                setupMocks();
                stubUpdate();
                var info = {
                    path: '/the/path/1',
                    tarball: 'existing.tgz',
                    shasum: '3da541559918a808c2402bba5012f6c60b27661c'
                };
                var cb = this.callback;
                verify.verify(info, this.callback);
            },
            'and doen\'t call update': function(d) {
                assert(!d.updateCalled);
            }
        },
        'with non-existent tarball':{
            topic: function() {
                setupMocks();
                stubUpdate();
                var info = {
                    path: '/the/path/2',
                    tarball: 'notarealfile.tgz',
                    shasum: thisFileHash
                };
                verify.verify(info, this.callback);
            },
            'update was called': function(d) {
                assert(d.updateCalled);
            }
        },
        'too many times': {
            topic: function() {
                var log = [];
                setupMocks(log);
                stubUpdate();
                var info = {
                    path: '/the/path/3',
                    tarball: 'existing.tgz',
                    shasum: thisFileHash
                };
                verify.counter()[info.path] = 4;
                var callback = this.callback;
                verify.verify(info, function(err, info){
                    callback(err, {info: info, log: log});
                });
            },
            'logged the error but succeeded anyway': function(d) {
                assert(d.info);
                assert.deepEqual(d.log, [' [4] file appears to be corrupt, skipping.. existing.tgz']);
            }
        },
        'bad hash': {
            topic: function() {
                var log = [];
                setupMocks(log);
                stubUpdate();
                var info = {
                    path: '/the/path/4',
                    tarball: 'existing.tgz',
                    shasum: 'badHash'
                };
                var callback = this.callback;
                verify.verify(info, function(err, info){
                    callback(err, {info: info, log: log});
                });
            },
            'logged the error and called update': function(d) {
                assert(d.info.updateCalled);
                assert.deepEqual(d.log, [
                        ' [0] shasum check failed for /the/path/4',
                        ' [0] found 3da541559918a808c2402bba5012f6c60b27661c expected badHash'
                ]);
            }
        },
        teardown: function() {
            mockery.disable();
        }
    }
};

vows.describe('verify').addBatch(tests).export(module);
