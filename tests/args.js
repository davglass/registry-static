var assert = require('assert'),
    mockery = require('mockery'),
    log = console.log;


var exit = process.exit;

function getArgs(exitFunc) {
    process.exit = exitFunc || function() {};
    var args = require('../lib/args');
    process.exit = exit;
    return args;
}

describe('args', function() {
    before(function(done) {
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
        done();
    });

    after(function(done){
        mockery.disable();
        mockery.deregisterAll();
        done();
    });

    beforeEach(function(done) {
        mockery.resetCache();
        done();
    });

    it('should export object', function(done) {
        assert.equal(typeof getArgs(), 'object');
        done();
    });

    it('process no args and error', function(done) {
        getArgs(function(c){
            assert.equal(c, 1);
        });
        done();
    });

    it('process valid args and return good', function(done) {
        process.argv = [
            'node',
            'asdfasda',
            '--dir',
            __dirname,
            '--domain',
            'foobar.com'
        ];
        var d = getArgs();
        assert.equal(d.domain, 'foobar.com');
        assert.equal(d.dir, __dirname);
        assert.equal(d.limit, 10);
        done();
    });

    it('process help and output', function(done) {
        process.argv = [
            'node',
            'asdfasda',
            '--help'
        ];
        var d;
        console.log = function(str) {
            d = str;
        };
        getArgs();
        console.log = log;
        assert(d.indexOf('registry-static@') > -1);
        done();
    });

    it('process version and return good', function(done) {
        process.argv = [
            'node',
            'asdfasda',
            '--version'
        ];
        console.log = function(){};
        assert(getArgs().version);
        console.log = log;
        done();
    });
});
