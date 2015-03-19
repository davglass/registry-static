var vows = require('vows'),
    assert = require('assert'),
    EventEmitter = require('events').EventEmitter,
    mockery = require('mockery'),
    logger,
    noop = function() {};

var called = {};
var QUIET = false;
var LOG;
var logFn;
var errFn;
var logged;

var setupMocks = function() {

    mockery.registerMock('davlog', {
        init: noop,
        info: noop,
        quiet: function() {
            called.quiet = called.quiet || 0;
            called.quiet++;
        },
        get logFn() { return logFn; },
        set logFn(a) {
            logFn = a;
            called.logFn = called.logFn || 0;
            called.logFn++;
        },
        get errFn() { return errFn; },
        set errFn(a) {
            errFn = a;
            called.errFn = called.logFn || 0;
            called.errFn++;
        }
    });

    mockery.registerMock('fs', {
        createWriteStream: function() {
            called.createWriteStream = called.createWriteStream || 0;
            called.createWriteStream++;
            var emitter = new EventEmitter();
            emitter.write = function(str) {
                logged = str;
            };
            emitter.end = function() {
                called.end = called.end || 0;
                called.end++;
            };
            return emitter;
        }
    });

    mockery.registerMock('mkdirp', {
        sync: function() {
            called.mkdirp = called.mkdirp || 0;
            called.mkdirp++;
        }
    });

    mockery.registerMock('./args', {
        get quiet() { return QUIET; },
        get log() { return LOG; }
    });
};

var tests = {
    setup: function() {
        setupMocks();
        mockery.enable({
            useCleanCache: true,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
        logger = require('../lib/logger');
    },
    'should export': {
        topic: function() {
            return logger;
        },
        'a single function': function(d) {
            assert.isFunction(d);
        },
        'and not be quiet': function() {
            assert.isUndefined(called.quiet);
        },
        'then should call quiet': {
            topic: function() {
                mockery.resetCache();
                QUIET = true;
                logger = require('../lib/logger');
                return logger;
            },
            'and be quiet': function() {
                assert.equal(called.quiet, 1);
            }
        },
        'then should do nothing': {
            topic: function() {
                logger();
                return true;
            },
            'if no log option': function() {
                assert.isUndefined(called.mkdirp);
            },
            'then should do things': {
                topic: function() {
                    LOG = '/foo/bar.log';
                    logger();
                    return true;
                },
                'and mkdirp': function() {
                    assert.equal(called.mkdirp, 1);
                },
                'and createWriteStream': function() {
                    assert.equal(called.createWriteStream, 1);
                },
                'and logFn should call write': function() {
                    assert.isFunction(logFn);
                    logFn('foo', 'bar', 'baz');
                    assert.equal('foo bar baz\n', logged);
                }, 
                'and errFn should call write': function() {
                    assert.isFunction(errFn);
                    errFn('fooErr', 'barErr', 'bazErr');
                    assert.equal('fooErr barErr bazErr\n', logged);
                },
                'and then continue on restart': {
                    topic: function() {
                        assert.isUndefined(called.end);
                        logger.restart();
                        return true;
                    },
                    'should have restarted': function() {
                        assert.equal(called.end, 1);
                    }
                }
            }
        }
    },
    teardown: function() {
        mockery.deregisterAll();
        mockery.disable();
    }
};


vows.describe('logger').addBatch(tests).export(module);
