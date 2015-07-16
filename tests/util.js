var vows = require('vows'),
    assert = require('assert'),
    mockery = require('mockery');

var json = {
    versions: {
        1: {
            dist: {
                tarball: 'http://example.com/foo/1/foo-1.tgz',
                shasum: '1abc123'
            }
        },
        2: {
            dist: {
                tarball: 'http://example.com/foo/2/foo-2.tgz',
                shasum: '2abc123'
            }
        }
    }
};

var options = {
    dir: '/mirror',
    limit: 2
};

var util;

var tests = {
    'should export': {
        topic: function() {
            mockery.registerMock('./verify.js', {
                verify: function(obj, callback){
                    obj.verified = true;
                    callback();
                }
            });
            mockery.enable({
                useCleanCache: true,
                warnOnReplace: false,
                warnOnUnregistered: false
            });
            util = require('../lib/util');
            return util;
        },
        'an object': function(d) {
            assert.isObject(d);
        },
        'with methods': function(d) {
            assert.isFunction(d.check);
        }
    },
    'check method': {
        topic: function(){
            mockery.enable();
            util.check(json, options, this.callback);
        },
        'tarballs verified': function(d) {
            assert(d[0].verified);
            assert.equal(d[0].path, '/foo/1/foo-1.tgz');
            assert.equal(d[0].tarball, '/foo/1/foo-1.tgz');
            assert(d[1].verified);
            assert.equal(d[1].path, '/foo/2/foo-2.tgz');
            assert.equal(d[1].tarball, '/foo/2/foo-2.tgz');
        },
        'early exit (versions)': {
            topic: function() {
                util.check({}, options, this.callback);
            },
            'no tarballs': function(d) {
                assert.isUndefined(d);
            }
        },
        'early exit (tarballs)': {
            topic: function() {
                util.check({
                    versions:{1:{}, 2:{}}
                }, options, this.callback);
            },
            'no tarballs': function(d) {
                assert.isUndefined(d);
            }
        }
    },
    teardown: function() {
        mockery.deregisterAll();
        mockery.disable();
    }
};

vows.describe('util').addBatch(tests).export(module);
