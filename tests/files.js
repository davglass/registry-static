var vows = require('vows'),
    path = require('path'),
    assert = require('assert'),
    mockery = require('mockery');

var testError = new Error();
var memblob = require('abstract-blob-store')();
var noop = function() { return ''; };
var setupMocks = function() {
    mockery.registerMock('./verify.js', {
        verify: function(obj, callback){
            obj.verified = true;
            if (obj.makeError) {
                callback(testError);
            } else {
                callback();
            }
        }
    });
    mockery.registerMock('./args.js', {
        dir: __dirname,
        limit: 2,
        blobstore: memblob
    });
    mockery.registerMock('./hooks', {
        afterTarball: function(info, callback, callback2) {
            info.afterTarballCalled = true;
            info.callbacksEqual = callback === callback2;
            callback();
        },
        tarball: function(info, callback, success) {
            info.tarballCalled = true;
            info.tarballPathCorrect = info.tarball === info.path;
            success();
        },
        indexJson: function(info, callback, success) {
            info.indexJsonCalled = true;
            if (info.makeError) {
                callback(testError);
            } else {
                success();
            }
        },
        versionJson: function(info, callback, success) {
            info.versionJsonCalled = true;
            success();
        }
    });
    mockery.registerMock('mkdirp', function(dir, callback) {
        callback();
    });
    mockery.registerMock('davlog', {
        init: noop,
        info: noop,
        warn: noop
    });
};

var files;

var tests = {
    setup: function() {
        setupMocks();
        mockery.enable({
            useCleanCache: true,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
        files = require('../lib/files');
    },
    'should export': {
        topic: function() {
            return files;
        },
        'an object': function(d) {
            assert.isObject(d);
        }, 'with methods': function(d) {
            ['saveJSON', 'saveTarballs'].forEach(function(name) {
                assert.isFunction(d[name]);
            });
        }
    },
    'method saveTarballs': {
        topic: function() {
            var tarballs = [
                {
                    path: 'foopath0.tgz'
                },
                {
                    path: 'foopath1.tgz'
                }
            ];
            var callback = this.callback;
            mkdirpRuns = 0;
            files.saveTarballs(tarballs, function(err){
                callback(err, tarballs);
            });
        },
        'sets tarball property': function(d) {
            assert.equal(d[0].tarball, 'foopath0.tgz');
            assert.equal(d[1].tarball, 'foopath1.tgz');
        },
        'tarball hook called, with correct tarball path': function(d) {
            assert(d[0].tarballCalled);
            assert(d[0].tarballPathCorrect);
            assert(d[1].tarballCalled);
            assert(d[1].tarballPathCorrect);
        },
        'afterTarball hook called, with to of the same callback': function(d) {
            assert(d[0].afterTarballCalled);
            assert(d[0].callbacksEqual);
            assert(d[1].afterTarballCalled);
            assert(d[1].callbacksEqual);
        },
        'early exit': {
            topic: function() {
                var tarballs = [
                    {
                        path: 'foopath0.tgz',
                        makeError: true
                    }
                ];
                var callback = this.callback;
                mkdirpRuns = 0;
                files.saveTarballs(tarballs, function(err) {
                    callback(null, err);
                });
            },
            'should call back with an error': function(e) {
                assert.strictEqual(e, testError);
            }
        }
    },
    'method saveJSON': {
        topic: function () {
            var info = {
                json: {name: 'foopackage'},
                seq: 97,
                latestSeq: 42,
                versions: [
                    {
                        json: {name: 'foopackage'},
                        version: '1.0.0'
                    },
                    {
                        json: {name: 'foopackage'},
                        version: '2.0.0'
                    }
                ]
            };
            var callback = this.callback;
            files.saveJSON(info, function() {
                callback(null, info);
            });
        },
        'saves 3 json files': function(d) {
            assert.deepEqual(memblob.data, {
                'foopackage/index.json': '{\n    "name": "foopackage"\n}\n',
                'foopackage/1.0.0/index.json': '{\n    "name": "foopackage"\n}\n',
                'foopackage/2.0.0/index.json': '{\n    "name": "foopackage"\n}\n'
            });
        },
        'indexJson hook called': function(d) {
            assert(d.indexJsonCalled);
        },
        'versionJson hook called': function(d) {
            assert(d.versions[0].versionJsonCalled);
            assert(d.versions[1].versionJsonCalled);
        },
        'early exit (no top level name)': {
            topic: function() {
                memblob.data = {};
                var info = {
                    json: {}
                };
                var callback = this.callback;
                files.saveJSON(info, function(){
                    callback(null, info);
                });
            },
            'no hooks called, no files saved': function(d){
                assert.deepEqual(memblob.data, {});
                assert(!d.indexJsonCalled);
            }
        },
        'early exit (error)': {
            topic: function() {
                memblob.data = {};
                var info = {
                    json: {
                        name: 'foo',
                        error: 'anError'
                    }
                };
                var callback = this.callback;
                files.saveJSON(info, function(err){
                    callback(null, {info: info, err: err});
                });
            },
            'no hooks called, no files saved, err returned': function(d){
                assert.deepEqual(memblob.data, {});
                assert(!d.info.indexJsonCalled);
                assert.equal(d.err, 'anError');
            }
        },
        'early exit (putAllParts)': {
            topic: function() {
                memblob.data = {};
                var info = {
                    json: {name: 'foopackage'},
                    makeError: true
                };
                var callback = this.callback;
                files.saveJSON(info, function(err){
                    callback(null, {info: info, err: err});
                });
            },
            'err returned in putAllParts': function(d){
                assert.deepEqual(memblob.data, []);
                assert(d.info.indexJsonCalled);
                assert.equal(d.err, testError);
            }
        },
        'early exit (putPart)': {
            topic: function() {
                memblob.data = {};
                var info = {
                    json: {name: 'foopackage'},
                    versions: [
                        {}
                    ]
                };
                var callback = this.callback;
                files.saveJSON(info, function(){
                    callback(null, info);
                });
            },
            'returned in puAllParts, indexJson written': function(d){
                assert.deepEqual(memblob.data, {'foopackage/index.json': '{\n    "name": "foopackage"\n}\n'});
                assert(d.indexJsonCalled);
                // no actual error here to test
            }
        },
        'early exit (no versions)': {
            topic: function() {
                memblob.data = {};
                var info = {
                    json: {name: 'foopackage'}
                };
                var callback = this.callback;
                files.saveJSON(info, function(){
                    callback(null, info);
                });
            },
            'returned before putAllParts, indexJson written': function(d){
                assert.deepEqual(memblob.data, {'foopackage/index.json': '{\n    "name": "foopackage"\n}\n'});
                assert(d.indexJsonCalled);
                // no actual error here to test
            }
        }
    },
    teardown: function() {
        mockery.deregisterAll();
        mockery.disable();
    }
};

vows.describe('files').addBatch(tests).export(module);
