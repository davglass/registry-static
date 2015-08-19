var assert = require('assert'),
    mockery = require('mockery'),
    crypto = require('crypto'),
    fs = require('fs'),
    http = require('http-https'),
    createReadStream = fs.createReadStream,
    createWriteStream = fs.createWriteStream;

function noop () {}

function clearData(done){
    log = [];
    memblob.data = {'existing.tgz': 'asdf'};
    done();
}

function stubUpdate() {
    verify.verify = cacheVerify;
    verify.update = function(info, callback) {
        info.updateCalled = true;
        callback(null, info);
    };
}

function stubVerify() {
    verify.update = cacheUpdate;
    verify.verify = function(info, callback) {
        info.verifyCalled = true;
        callback(null, info);
    };
}

var log;
var verify;
var cacheUpdate;
var cacheVerify;
var thisFileHash;
var badRegistry = false;
var memblob = require('abstract-blob-store')();

describe('verify', function(){
    before(function(done){
        mockery.registerMock('./args', {
            get registry() {
                return badRegistry ? 'http://fhgidygfi' : 'http://registry.npmjs.org';
            },
            blobstore: memblob
        });
        mockery.registerMock('davlog', {
            init: noop,
            info: noop,
            warn: noop,
            err: function(msg, file) {
                log.push([].slice.call(arguments).join(' '));
            }
        });
        mockery.enable({
            useCleanCache: true,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
        verify = require('../lib/verify');
        cacheVerify = verify.verify;
        cacheUpdate = verify.update;
        done();
    });
    after(function(done){
        mockery.deregisterAll();
        mockery.disable();
        done();
    });

    it('should export an object with methods', function(done){
        assert.equal(typeof verify, 'object');
        ['verify', 'update', 'report', 'counter'].forEach(function(name) {
            assert.equal(typeof verify[name], 'function');
        });
        done();
    });

    describe('update method', function(){
        before(function(done){
            stubVerify();
            done();
        });
        beforeEach(clearData);

        it('downloads the file and calls verify', function(done){
            var info = {
                path: '//registry-static/-/registry-static-0.1.11.tgz',
                tarball: 'registry-static-0.1.11.tgz'
            };
            verify.update(info, function(err) {
                assert.ifError(err);
                assert.equal(log.length, 0);
                assert.equal(info.http, 200);
                assert(info.verifyCalled);
                done();
            });
        });

        it('tries to download with bad server and calls back with an error', function(done){
            badRegistry = true;
            var info = {
                path: '//async/-/async-0.9.0.tgz',
                tarball: 'async-0.9.0.tgz'
            };
            verify.update(info, function(err) {
                badRegistry = false;
                assert.deepEqual(log, [' [1] failed to download async-0.9.0.tgz']);
                assert.equal(err.message, 'failed to download async-0.9.0.tgz');
                done();
            });
        });

        it('tries to download with a 404 file and calls back with an error', function(done){
            var callback = this.callback;
            var info = {
                path: '//foobarbaz.tgz',
                tarball: 'foo-1.0.0.tgz'
            };
            verify.update(info, function(err) {
                assert.deepEqual(log, [' [1] failed to download with a 404 foo-1.0.0.tgz']);
                assert.equal(err.message, 'failed to download foo-1.0.0.tgz');
                done();
            });
        });
    });

    describe('verify method', function(){
        before(function(done){
            stubUpdate();
            var shasum = crypto.createHash('sha1');
            shasum.setEncoding('hex');
            fs.createReadStream(__filename)
                .on('end', function(){
                    shasum.end();
                    thisFileHash = shasum.read();
                    done();
                })
            .pipe(shasum);
        });
        beforeEach(clearData);

        it('checks hash and does\'t call update', function(done){
            var info = {
                path: '/the/path/1',
                tarball: 'existing.tgz',
                shasum: '3da541559918a808c2402bba5012f6c60b27661c'
            };
            verify.verify(info, function(err, d) {
                assert.ifError(err);
                assert(!d.updateCalled);
                done();
            });
        });

        it('with non-existent tarball, update was called', function(done) {
            var info = {
                path: '/the/path/2',
                tarball: 'notarealfile.tgz',
                shasum: thisFileHash
            };
            verify.verify(info, function(err, d) {
                assert.ifError(err);
                assert(d.updateCalled);
                done();
            });
        });

        it('too many times, logged the error but succeeded anyway', function(done){
            var info = {
                path: '/the/path/3',
                tarball: 'existing.tgz',
                shasum: thisFileHash
            };
            verify.counter()[info.path] = 4;
            verify.verify(info, function(err, info){
                assert.ifError(err);
                assert(info);
                assert.deepEqual(log, [' [4] file appears to be corrupt, skipping.. existing.tgz']);
                done();
            });
        });

        it('bad hash, logged the error and called update', function(done){
            var info = {
                path: '/the/path/4',
                tarball: 'existing.tgz',
                shasum: 'badHash'
            };
            verify.verify(info, function(err, info){
                assert.ifError(err);
                assert(info.updateCalled);
                assert.deepEqual(log, [
                        ' [0] shasum check failed for /the/path/4',
                        ' [0] found 3da541559918a808c2402bba5012f6c60b27661c expected badHash'
                ]);
                done();
            });
        });
    });
});
