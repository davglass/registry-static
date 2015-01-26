var vows = require('vows'),
    assert = require('assert'),
    mockery = require('mockery'),
    crypto = require('crypto'),
    fs = require('fs'),
    createReadStream = fs.createReadStream;

function noop () {}

function setupMocks() {
    mockery.registerMock('fs', {
        exists: function(file, callback) {
            callback(/existing.tgz/.test(file));
        },
        createReadStream: function(file) {
            return createReadStream(__filename);
        }
    });
    mockery.registerMock('./args', {});
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
}

function setThisFileHash (callback) {
    var shasum = crypto.createHash('sha1');
    shasum.setEncoding('hex');
    fs.createReadStream(__filename)
        .on('end', function(){
            shasum.end();
            thisFileHash = shasum.read();
            callback();
        })
    .pipe(shasum);
}

var verify;
var cacheUpdate;
var thisFileHash;
var log = [];

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
            ['verify', 'update'].forEach(function(name) {
                assert.isFunction(d[name]);
            });
        },
    },
    'verify method': {
        topic: function() {
            setupMocks();
            verify = require('../lib/verify');
            cacheUpdate = verify.update;
            verify.update = function(info, callback) {
                info.updateCalled = true;
                callback(null, info);
            };

            callback = this.callback;
            setThisFileHash(function() {
                var info = {
                    path: '/the/path/1',
                    tarball: 'existing.tgz',
                    shasum: thisFileHash
                };
                verify.verify(info, callback);
            });
        },
        'checks hash and doesn\'t call update': function(d) {
            assert(!d.updateCalled);
        },
        'with non-existent tarball':{
            topic: function() {
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
                log = [];
                var info = {
                    path: '/the/path/3',
                    tarball: 'existing.tgz',
                    shasum: thisFileHash
                };
                verify.counter()[info.path] = 4;
                verify.verify(info, this.callback);
            },
            'logged the error but succeeded anyway': function(d) {
                assert(d);
                assert.deepEqual(log, [' [4] file appears to be corrupt, skipping.. existing.tgz']);
                log = [];
            }
        },
        'bad hash': {
            topic: function() {
                log = [];
                var info = {
                    path: '/the/path/4',
                    tarball: 'existing.tgz',
                    shasum: 'badHash'
                };
                verify.verify(info, this.callback);
            },
            'logged the error and called update': function(d) {
                assert(d.updateCalled);
                assert.deepEqual(log, [
                        ' [0] shasum check failed for /the/path/4',
                        ' [0] found ' + thisFileHash + ' expected badHash'
                ]);
            }
        },
        teardown: function() {
            verify.update = cacheUpdate;
        }
    }
};

vows.describe('verify').addBatch(tests).export(module);
