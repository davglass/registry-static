var assert = require('assert'),
    mockery = require('mockery'),
    log = console.log,
    noop = function() {
        var cb = arguments[arguments.length - 1];
        if (cb) {
            cb(null, '{ "data": true }');
        }
    };

var REPORT = false, WRITE;

var check;

describe('check', function(){
    before(function(done){
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
            writeFile: function(f, d, e, callback) {
                WRITE = JSON.parse(d);
                callback();
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
        mockery.enable({
            useCleanCache: true,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
        check = require('../lib/check');
        done();
    });

    after(function(done){
        mockery.disable();
        mockery.deregisterAll();
        done();
    });

    beforeEach(function(done){
        console.log = function(){};
        done();
    });

    afterEach(function(done){
        console.log = log;
        done();
    });

    it('should export three methods', function(done) {
        assert.equal('function', typeof check.check);
        assert.equal('function', typeof check.run);
        assert.equal('function', typeof check.exit);
        done();
    });

    it('check method should do something', function(done) {
        check.check('/path/foo', function(err, d){
            assert.ifError(err);
            assert.ok(d);
            var data = JSON.parse(d);
            assert.ok(data);
            assert(data.data);
            done();
        });
    });

    it('run method should exit', function(done) {
        check.exit = function() {
            done();
        };
        check.run();
    });

    it('run method with report should write file and exit', function(done){
        REPORT = true;
        check.exit = function() {
            assert.ok(WRITE);
            assert.ok(WRITE.report);
            done();
        };
        check.run();
    });
});
