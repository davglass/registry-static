var assert = require('assert'),
    mockery = require('mockery');

var getResponse;

var goodBody = {
    name: 'foo',
    description: 'bar',
    'dist-tags': {
        latest: '1',
        alpha: '2'
    },
    versions: {
        '1': {
            dist: {
                tarball: 'http://example.com/foo/1.tgz',
                shasum: '123abc'
            }
        },
        '2': {
            dist: {
                tarball: 'http://example.com/foo/2.tgz',
                shasum: '456def'
            }
        }
    }
};

var goodBodyNoTags = {
    name: 'foo',
    description: 'bar',
    versions: {
        '1': {
            dist: {
                tarball: 'http://example.com/foo/1.tgz',
                shasum: '123abc'
            }
        },
        '2': {
            dist: {
                tarball: 'http://example.com/foo/2.tgz',
                shasum: '456def'
            }
        }
    }
};

var goodBodyNoVersions = {
    name: 'foo',
    description: 'bar',
};

var savedTarballs, savedJSON, one;

describe('one', function(){
    before(function(done){
        mockery.registerMock('request', {
            get: function(url, opts, cb){
                assert.equal(url, 'https://registry.npmjs.org/foo');
                assert.deepEqual(opts, {json: true});
                cb.apply(null, getResponse);
            }
        });
        mockery.registerMock('./files', {
            saveTarballs: function(tarballs, cb){
                savedTarballs = tarballs;
                cb();
            },
            saveJSON: function(json, cb){
                savedJSON = json;
                cb();
            }
        });
        mockery.registerMock('./args', {
            domain: 'example.com'
        });
        mockery.enable({
            useCleanCache: true,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
        one = require('../lib/one');
        done();
    });
    it('should export a function', function(done){
        assert.equal(typeof one, 'function');
        done();
    });
    it('with a package name saves tarballs and json', function(done) {
        getResponse = [null, {statusCode: 200}, goodBody];
        one('foo', function(){

            assert.deepEqual(savedTarballs, [
                {path: '/foo/1.tgz', tarball: 'http://example.com/foo/1.tgz', shasum: '123abc'},
                {path: '/foo/2.tgz', tarball: 'http://example.com/foo/2.tgz', shasum: '456def'}
            ]);

            assert.deepEqual(savedJSON, {
                json: goodBody,
                versions: [
                    {version: 'latest', json: goodBody.versions['1']},
                    {version: 'alpha', json: goodBody.versions['2']},
                    {version: '1', json: goodBody.versions['1']},
                    {version: '2', json: goodBody.versions['2']}
                ],
                tarballs: [
                    {path: '/foo/1.tgz', tarball: 'http://example.com/foo/1.tgz', shasum: '123abc'},
                    {path: '/foo/2.tgz', tarball: 'http://example.com/foo/2.tgz', shasum: '456def'}
                ]
            });
            done();
        });
    });
    it('with no dist-tags saves tarballs and json', function(done){
        getResponse = [null, {statusCode: 200}, goodBodyNoTags];
        one('foo', function(){
            assert.deepEqual(savedTarballs, [
                {path: '/foo/1.tgz', tarball: 'http://example.com/foo/1.tgz', shasum: '123abc'},
                {path: '/foo/2.tgz', tarball: 'http://example.com/foo/2.tgz', shasum: '456def'}
            ]);
            assert.deepEqual(savedJSON, {
                json: goodBodyNoTags,
                versions: [
                    {version: '1', json: goodBodyNoTags.versions['1']},
                    {version: '2', json: goodBodyNoTags.versions['2']}
                ],
                tarballs: [
                    {path: '/foo/1.tgz', tarball: 'http://example.com/foo/1.tgz', shasum: '123abc'},
                    {path: '/foo/2.tgz', tarball: 'http://example.com/foo/2.tgz', shasum: '456def'}
                ]
            });
            done();
        });
    });
    it('with no versions saves tarballs and json', function(done){
        getResponse = [null, {statusCode: 200}, goodBodyNoVersions];
        one('foo', function(){
            assert.deepEqual(savedTarballs, []);
            assert.deepEqual(savedJSON, {
                json: goodBodyNoVersions,
                versions: [],
                tarballs: []
            });
            done();
        });
    });
    it('bad request (err) errs back', function(done){
        getResponse = [new Error('fake error')];
        one('foo', function(err){
            assert.equal(err.message, 'fake error');
            done();
        });
    });
    it('bad request (404)', function(done){
        getResponse = [null, {statusCode: 404}];
        one('foo', function(err){
            assert.equal(err.message, 'npm responded with status code: 404');
            done();
        });
    });
});
