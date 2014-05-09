var vows = require('vows'),
    assert = require('assert'),
    mockery = require('mockery');

mockery.registerMock('davlog', {
    err: function() {
    }
});

mockery.enable({
    useCleanCache: true,
    warnOnReplace: false,
    warnOnUnregistered: false
});
var args = require('../lib/args');

var exit = process.exit;

var tests = {
    'should export': {
        topic: function() {
            return args
        },
        'function': function(d) {
            assert.isFunction(d);
        }
    },
    'process no args': {
        topic: function() {
            var code;
            process.exit = function(c) {
                code = c;
            }
            args();
            return code;
        },
        'and error': function(d) {
            assert.ok(d);
            assert.equal(d, 250);
        }
    },
    'process valid args': {
        topic: function() {
            process.argv = [
                'node',
                'asdfasda',
                '--dir',
                __dirname,
                '--domain',
                'foobar.com'
            ];
            return args();
        },
        'and return good': function(d) {
            assert.ok(d);
            assert.equal(d.domain, 'foobar.com');
            assert.equal(d.dir, __dirname);
            assert.equal(d.limit, 10);
        }
    },
    'process version': {
        topic: function() {
            process.argv = [
                'node',
                'asdfasda',
                '--version'
            ];
            return args();
        },
        'and return good': function(d) {
            assert.ok(d);
            assert.isTrue(d.version);
        }
    }
};

vows.describe('args').addBatch(tests).export(module);
