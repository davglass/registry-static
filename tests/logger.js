var assert = require('assert'),
    EventEmitter = require('events').EventEmitter,
    mockery = require('mockery'),
    logger,
    noop = function() {};

var called = {};
var QUIET = false;
var LOG;
var errFn;
var logged;

describe('logger', function(){
    beforeEach(function(done){
        mockery.registerMock('davlog', {
            init: function(){
                return this;
            },
            info: noop,
            quiet: function() {
                called.quiet = called.quiet || 0;
                called.quiet++;
            },
            stdout: {
                end: noop
            },
            stderr: {
                end: noop
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

    afterEach(function(done){
        mockery.deregisterAll();
        mockery.disable();
        done();
    });

    it('should export a single object', function(done){
        assert.equal(typeof logger, 'object');
        assert.equal(typeof called.quiet, 'undefined');
        done();
    });

    it('quiet', function(done){
        mockery.resetCache();
        QUIET = true;
        logger = require('../lib/logger');
        assert.equal(called.quiet, 1);
        assert.equal(typeof called.mkdirp, 'undefined');
        done();
    });

    it('continue on restart', function(done){
        assert.equal(typeof called.end, 'undefined');
        logger.stdout.end = function() {
            done();
        };
        logger.restart();
    });
});
