var vows = require('vows'),
    assert = require('assert'),
    mockery = require('mockery');

var noop = function() { return ''; };
var called = {};
var CLEAN = false;
var CONF;
var SINCE;
var WRITE;
var EXISTS;

var setupMocks = function() {
    mockery.registerMock('./args', {
        domain: 'example.com',
        dir: __dirname,
        get since() {
            return SINCE;
        },
        get clean() {
            return CLEAN;
        }
    });
    mockery.registerMock('fs', {
        readFileSync: noop,
        readFile: function(f, t, callback) {
            callback(null, '{}');
        },
        writeFile: function(f, d, t, callback) {
            WRITE = d;
            callback();
        },
        unlink: function(file, callback) {
            called['fs.unlink'] = called['fs.unlink'] || 0;
            called['fs.unlink']++;
            callback();
        },
        exists: function(f, callback) {
            callback(EXISTS);
        },
        createWriteStream: function() {
            called.createWriteStream = called.createWriteStream || 0;
            called.createWriteStream++;
        },
        createReadStream: function() {
            called.createReadStream = called.createReadStream || 0;
            called.createReadStream++;
            return {
                pipe: noop,
                on: function(name, callback) {
                    callback();
                    return {
                        pipe: noop
                    };
                }
            };
        }
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
            index.clean(this.callback);
        },
        'should do nothing without config': function(d) {
            assert.equal(called['fs.unlink'], undefined);
        },
        'with options': {
            topic: function() {
                CLEAN = true;
                index.clean(this.callback);
                CLEAN = false;
            },
            'should unlink file': function(d) {
                assert.equal(called['fs.unlink'], 1);
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
                self.callback(null, JSON.parse(WRITE));
            });
        },
        'should do its thing': function(d) {
            assert.equal(d.couchdb, 'Welcome');
            assert.equal(d.processing, 'foo');
        }
    },
    'defaults method': {
        topic: function() {
            index.defaults(this.callback);
        },
        'should do its thing': function(d) {
            assert.equal(called.mkdirp, 1);
            assert.equal(called.createWriteStream, 2);
            assert.equal(called.createReadStream, 2);
        },
        'defaults method with index': {
            topic: function() {
                EXISTS = true;
                index.defaults(this.callback);
            },
            'should do its thing': function(d) {
                assert.equal(called.mkdirp, 2);
                assert.equal(called.createWriteStream, 3);
                assert.equal(called.createReadStream, 3);
            }
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
                self.callback(null, JSON.parse(WRITE));
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
