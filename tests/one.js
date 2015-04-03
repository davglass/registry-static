var vows = require('vows'),
    assert = require('assert'),
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
                tarball: 'https://registry.npmjs.org/foo/1.tgz',
                shasum: '123abc'
            }
        },
        '2': {
            dist: {
                tarball: 'https://registry.npmjs.org/foo/2.tgz',
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
                tarball: 'https://registry.npmjs.org/foo/1.tgz',
                shasum: '123abc'
            }
        },
        '2': {
            dist: {
                tarball: 'https://registry.npmjs.org/foo/2.tgz',
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

var tests = {
    setup: function(){
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
        mockery.enable({
            useCleanCache: true,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
        one = require('../lib/one');
    },
    'should export': {
        topic: function(){
            return one;
        },
        'a function': function(d){
            assert.isFunction(d);
        }
    },
    'with a package name': {
        topic: function(){
            var cb = this.callback;
            getResponse = [null, {statusCode: 200}, goodBody];
            one('foo', function(){
                cb(null, [savedTarballs, savedJSON]);
            });
        },
        'saves tarballs': function(d){
            assert.deepEqual(d[0], [
                {path: '/foo/1.tgz', tarball: 'https://registry.npmjs.org/foo/1.tgz', shasum: '123abc'},
                {path: '/foo/2.tgz', tarball: 'https://registry.npmjs.org/foo/2.tgz', shasum: '456def'}
            ]);
        },
        'saves json': function(d){
            assert.deepEqual(d[1], {
                json: goodBody,
                versions: [
                    {version: 'latest', json: goodBody.versions['1']},
                    {version: 'alpha', json: goodBody.versions['2']},
                    {version: '1', json: goodBody.versions['1']},
                    {version: '2', json: goodBody.versions['2']}
                ],
                tarballs: [
                    {path: '/foo/1.tgz', tarball: 'https://registry.npmjs.org/foo/1.tgz', shasum: '123abc'},
                    {path: '/foo/2.tgz', tarball: 'https://registry.npmjs.org/foo/2.tgz', shasum: '456def'}
                ]
            });
        }
    },
    'with no dist-tags': {
        topic: function(){
            var cb = this.callback;
            getResponse = [null, {statusCode: 200}, goodBodyNoTags];
            one('foo', function(){
                cb(null, [savedTarballs, savedJSON]);
            });
        },
        'saves tarballs': function(d){
            assert.deepEqual(d[0], [
                {path: '/foo/1.tgz', tarball: 'https://registry.npmjs.org/foo/1.tgz', shasum: '123abc'},
                {path: '/foo/2.tgz', tarball: 'https://registry.npmjs.org/foo/2.tgz', shasum: '456def'}
            ]);
        },
        'saves json': function(d){
            assert.deepEqual(d[1], {
                json: goodBodyNoTags,
                versions: [
                    {version: '1', json: goodBodyNoTags.versions['1']},
                    {version: '2', json: goodBodyNoTags.versions['2']}
                ],
                tarballs: [
                    {path: '/foo/1.tgz', tarball: 'https://registry.npmjs.org/foo/1.tgz', shasum: '123abc'},
                    {path: '/foo/2.tgz', tarball: 'https://registry.npmjs.org/foo/2.tgz', shasum: '456def'}
                ]
            });
        }
    },
    'with no versions': {
        topic: function(){
            var cb = this.callback;
            getResponse = [null, {statusCode: 200}, goodBodyNoVersions];
            one('foo', function(){
                cb(null, [savedTarballs, savedJSON]);
            });
        },
        'saves tarballs': function(d){
            assert.deepEqual(d[0], []);
        },
        'saves json': function(d){
            assert.deepEqual(d[1], {
                json: goodBodyNoVersions,
                versions: [],
                tarballs: []
            });
        }
    },
    'bad request (err)': {
        topic: function(){
            var cb = this.callback;
            getResponse = [new Error('fake error')];
            one('foo', function(err){
                cb(null, err);
            });
        },
        'errs back': function(d){
            assert.equal(d.message, 'fake error');
        }
    },
    'bad request (404)': {
        topic: function(){
            var cb = this.callback;
            getResponse = [null, {statusCode: 404}];
            one('foo', function(err){
                cb(null, err);
            });
        },
        'errs back': function(d){
            assert.equal(d.message, 'npm responded with status code: 404');
        }
    },
    teardown: function(){
        mockery.deregisterAll();
        mockery.disable();
    }
};

vows.describe('one').addBatch(tests).export(module);
