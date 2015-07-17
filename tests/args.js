var vows = require('vows'),
    assert = require('assert'),
    mockery = require('mockery'),
    log = console.log;

mockery.registerMock('davlog', {
    err: function() {
    }
});
mockery.registerMock('fs-blob-store', function(x){
    return x;
});

mockery.enable({
    useCleanCache: true,
    warnOnReplace: false,
    warnOnUnregistered: false
});

var exit = process.exit;

function getArgs(exitFunc) {
    process.exit = exitFunc || function() {};
    mockery.resetCache();
    var args = require('../lib/args');
    process.exit = exit;
    return args;
}

var tests = {
    'should export': {
        topic: function() {
            return getArgs();
        },
        'object': function(d) {
            assert.isObject(d);
        }
    },
    'process no args': {
        topic: function() {
            var code;
            getArgs(function(c) {
                code = c;
            });
            return code;
        },
        'and error': function(d) {
            assert.ok(d);
            assert.equal(d, 1);
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
            return getArgs();
        },
        'and return good': function(d) {
            assert.ok(d);
            assert.equal(d.domain, 'foobar.com');
            assert.equal(d.dir, __dirname);
            assert.equal(d.limit, 10);
        }
    },
    'process help': {
        topic: function() {
            process.argv = [
                'node',
                'asdfasda',
                '--help'
            ];
            var data;
            console.log = function(str) {
                data = str;
            };
            getArgs();
            console.log = log;
            return data;
        },
        'and output': function(d) {
            assert.ok(d);
            assert.isTrue(d.indexOf('registry-static@') > -1);
        }
    },
    'process version': {
        topic: function() {
            process.argv = [
                'node',
                'asdfasda',
                '--version'
            ];
            return getArgs();
        },
        'and return good': function(d) {
            assert.ok(d);
            assert.isTrue(d.version);
        }
    }
};

vows.describe('args').addBatch(tests).export(module);
