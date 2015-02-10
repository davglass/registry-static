var vows = require('vows'),
    assert = require('assert'),
    mockery = require('mockery'),
    noop = function() {
        var cb = arguments[arguments.length - 1];
        if (cb) {
            cb(null, '{ "data": true }');
        }
    };

var REPORT = false;

var setupMocks = function() {
    mockery.registerMock('davlog', {
        quiet: noop
    });
    mockery.registerMock('./args', {
        dir: '/path/to/dir',
        get report() { return REPORT; }
    });
    mockery.registerMock('fs', {
        readdir: function(d, callback) {
            callback(null, []);
        },
        readFile: noop,
        writeFile: function(f, d, callback) {
            WRITE = JSON.parse(d);
        }
    });
    mockery.registerMock('./util', {
        check: noop
    });
    mockery.registerMock('./verify.js', {
        report: function() {
            return { report: true };
        }
    });
};

var check;

var tests = {
    setup: function() {
        setupMocks();
        mockery.enable({
            useCleanCache: true,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
        check = require('../lib/check');
    },
    'should export': {
        topic: function() {
            return check;
        },
        'three methods': function(d) {
            assert.isFunction(d.check);
            assert.isFunction(d.run);
            assert.isFunction(d.exit);
        }
    },
    'check method': {
        topic: function() {
            check.check('/path/foo', this.callback);
        },
        'should do something': function(d) {
            assert.ok(d);
            var data = JSON.parse(d);
            assert.ok(data);
            assert.isTrue(data.data);
        }
    },
    'run method': {
        topic: function() {
            check.exit = function() {
                EXIT = true;
            };
            check.run();
            return true;
        },
        'should exit': function(d) {
            assert.ok(EXIT);
        }
    },
    'run method with report': {
        topic: function() {
            REPORT = true;
            check.exit = function() {
                EXIT = true;
            };
            check.run();
            return true;
        },
        'should write file': function(d) {
            assert.ok(WRITE);
            assert.ok(WRITE.report);
        },
        'should exit': function(d) {
            assert.ok(EXIT);
        }
    },
    teardown: function() {
        mockery.deregisterAll();
        mockery.disable();
    }
};

vows.describe('check').addBatch(tests).export(module);
