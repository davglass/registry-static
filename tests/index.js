var vows = require('vows'),
    assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    mockery = require('mockery');

var noop = function() { return ''; };
var called = {};
var CLEAN = false;
var CONF;
var SINCE;
var WRITE;

var memblob = require('abstract-blob-store')();

var setupMocks = function() {
    mockery.registerMock('./args', {
        domain: 'example.com',
        dir: __dirname,
        get since() {
            return SINCE;
        },
        get clean() {
            return CLEAN;
        },
        blobstore: memblob,
        seqFile: 'seqfile',
        error: path.resolve('./defaults/404.json'),
        index: path.resolve('./defaults/index.json')
    });
    mockery.registerMock('follow-registry', function(conf) {
        called.follow = called.follow || 0;
        called.follow++;
        CONF = conf;
    });
    mockery.registerMock('mkdirp', function(f, callback) {
        called.mkdirp = called.mkdirp || 0;
        called.mkdirp++;
        callback();
    });
    mockery.registerMock('http-https', {});
    mockery.registerMock('./files.js', {
        saveTarballs: function(d, callback) {
            called.saveTarballs = called.saveTarballs || 0;
            called.saveTarballs++;
            callback();
        },
        saveJSON: function(d, callback) {
            called.saveJSON = called.saveJSON || 0;
            called.saveJSON++;
            callback();
        }
    });
    mockery.registerMock('./logger', noop);
    mockery.registerMock('davlog', {
        init: noop,
        info: noop,
        warn: noop
    });
};

var index;

var tests = {
    setup: function() {
        setupMocks();
        mockery.enable({
            useCleanCache: true,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
    },
    'should export': {
        topic: function() {
            index = require('../lib/index.js');
            return index;
        },
        'an object': function(d) {
            assert.isObject(d);
        },
        'with methods': function(d) {
            ['start', 'defaults', 'change', 'run', 'clean', 'updateIndex'].forEach(function(name) {
                assert.isFunction(d[name]);
            });
        }
    },
    'start method': {
        topic: function() {
            var data = {},
                hold = {};
            ['run', 'clean', 'defaults'].forEach(function(name) {
                hold[name] = index[name];
                index[name] = function(callback) {
                    data[name] = true;
                    if (callback) { callback(); }
                };
            });
            index.start();
            Object.keys(hold).forEach(function(name) {
                index[name] = hold[name];
            });
            return data;
        },
        'should call run, clean and defaults': function(d) {
            assert.isObject(d);
            assert.isTrue(d.run);
            assert.isTrue(d.clean);
            assert.isTrue(d.defaults);
        }
    },
    'clean method': {
        topic: function() {
            var unlinked;
            fs.unlink = function(x, cb){
                unlinked = x;
                cb();
            };
            var self = this;
            index.clean(function(err){
                self.callback(err, unlinked);
            });
        },
        'should do nothing without config': function(d) {
            assert(!d);
        },
        'with options': {
            topic: function() {
                fs.oldUnlink = fs.unlink;
                var unlinked;
                fs.unlink = function(x, cb){
                    unlinked = x;
                    cb();
                };
                var self = this;
                CLEAN = true;
                index.clean(function(err){
                    CLEAN = false;
                    self.callback(err, unlinked);
                });
            },
            'should unlink file': function(d) {
                assert.equal(d, 'seqfile');
            },
        }
    },
    'run method': {
        topic: function() {
            index.setTimer = noop;
            index.run();
            return null;
        },
        'should execute': function(d) {
            assert.equal(called.follow, 1);
            assert.ok(CONF);
            assert.isFunction(CONF.handler);
            CONF = undefined;
        },
        'run method with since': {
            topic: function() {
                SINCE = 12345;
                index.setTimer = noop;
                index.run();
                return null;
            },
            'should execute': function(d) {
                assert.equal(called.follow, 2);
                assert.ok(CONF);
                assert.isFunction(CONF.handler);
                assert.equal(CONF.since, 12345);
                CONF = undefined;
            }
        }
    },
    'updateIndex method': {
        topic: function() {
            var self = this;
            index.updateIndex({
                json: {
                    name: 'foo'
                }
            }, function() {
                var result = JSON.parse(memblob.data['index.json']);
                memblob.data = {};
                self.callback(null, result);
            });
        },
        'should do its thing': function(d) {
            assert.equal(d.couchdb, 'Welcome');
            assert.equal(d.processing, 'foo');
        }
    },
    'defaults method': {
        topic: function() {
            var skipped = [];
            var opts = {
                blobstore: require('abstract-blob-store')(),
                error: path.resolve('./defaults/404.json'),
                index: path.resolve('./defaults/index.json')
            };
            var self = this;
            index.defaults(opts, function(err, data){
                if (err) {
                    return self.callback(err);
                }
                skipped.push(data);
                opts.blobstore.data = {'index.json': 'asdf'};
                index.defaults(opts, function(err, data){
                    if (err) {
                        return self.callback(err);
                    }
                    skipped.push(data);
                    self.callback(null, {skipped:skipped, blobstore: opts.blobstore});
                });
            });
        },
        'should do its thing (no index)': function(d) {
            assert(d.skipped[0]); // not skipped
        },
        'should do its thing (index)': function(d) {
            assert(!d.skipped[1]); // skipped
        }
    },
    'change method': {
        topic: function() {
            var self = this;
            index.change({
                json: {
                    name: 'bar',
                    versions: {}
                },
                versions: ['']
            }, function() {
                self.callback(null, JSON.parse(memblob.data['index.json']));
            });
        },
        'should do its thing': function(d) {
            assert.equal(d.couchdb, 'Welcome');
            assert.equal(d.processing, 'bar');
            assert.equal(called.saveTarballs, 1);
            assert.equal(called.saveJSON, 1);
        },
        'when bad JSON is provided': {
            topic: function() {
                var self = this;
                var oldCalled = called;
                called = {};
                index.change({json: '<xml>not json</xml>'}, function(err){
                    var newCalled = called;
                    called = oldCalled;
                    self.callback(null, newCalled);
                });
            },
            'no error. callback is called (early)': function (d) {
                assert.deepEqual({}, d);
            }
        }
    },
    teardown: function() {
        mockery.deregisterAll();
        mockery.disable();
    }
};

vows.describe('index').addBatch(tests).export(module);
