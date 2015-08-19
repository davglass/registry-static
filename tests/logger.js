var assert = require('assert'),
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

describe('logger', function(){
    before(function(done){
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
        mockery.enable({
            useCleanCache: true,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
        logger = require('../lib/logger');
        done();
    });

    after(function(done){
        mockery.deregisterAll();
        mockery.disable();
        done();
    });

    it('should export a single function', function(done){
        assert.equal(typeof logger, 'function');
        assert.equal(typeof called.quiet, 'undefined');
        done();
    });

    it('quiet', function(done){
        mockery.resetCache();
        QUIET = true;
        logger = require('../lib/logger');
        assert.equal(called.quiet, 1);
        logger();
        assert.equal(typeof called.mkdirp, 'undefined');
        done();
    });

    it('not quiet', function(done){
        LOG = '/foo/bar.log';
        logger();
        // for 0.10.x
        process.nextTick(function(){
            assert.equal(called.mkdirp, 1);
            assert.equal(called.createWriteStream, 1);
            assert.equal(typeof logFn, 'function');
            logFn('foo', 'bar', 'baz');
            assert.equal('foo bar baz\n', logged);
            assert.equal(typeof errFn, 'function');
            errFn('fooErr', 'barErr', 'bazErr');
            assert.equal('fooErr barErr bazErr\n', logged);
            done();
        });
    });

    it('continue on restart', function(done){
        assert.equal(typeof called.end, 'undefined');
        logger();
        logger.writer.end = function() {
            done();
        };
        logger.restart();
    });
});
