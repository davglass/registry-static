var assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    mockery = require('mockery');

var noop = function() { return ''; };
var called = {};
var oneData = [];
var CLEAN = false;
var CONF;
var SINCE;
var WRITE;

var memblob = require('abstract-blob-store')();

var index;

describe('index', function(){
    before(function(done){
        mockery.registerMock('./args', {
            domain: 'example.com',
            dir: __dirname,
            get since() {
                return SINCE;
            },
                get clean() {
                    return CLEAN;
                },
            blobstore: memblob,
            seqFile: 'seqfile',
            error: path.resolve('./defaults/404.json'),
            index: path.resolve('./defaults/index.json')
        });
        mockery.registerMock('follow-registry', function(conf) {
            called.follow = called.follow || 0;
            called.follow++;
            CONF = conf;
        });
        mockery.registerMock('mkdirp', function(f, callback) {
            called.mkdirp = called.mkdirp || 0;
            called.mkdirp++;
            callback();
        });
        mockery.registerMock('http-https', {});
        mockery.registerMock('./files.js', {
            saveTarballs: function(d, callback) {
                called.saveTarballs = called.saveTarballs || 0;
                called.saveTarballs++;
                callback();
            },
            saveJSON: function(d, callback) {
                called.saveJSON = called.saveJSON || 0;
                called.saveJSON++;
                callback();
            }
        });
        mockery.registerMock('./hooks', {
            globalIndexJson: function (data, cb, success) {
                success();
            },
            beforeAll: function(data, cb, success) {
                success();
            },
            afterAll: function(data, cb, success) {
                success();
            }
        });
        mockery.registerMock('./logger', {
            init: noop,
            info: noop,
            warn: noop
        });
        mockery.registerMock('./one', function(data, callback) {
            oneData.push(data);
            callback();
        });
        mockery.enable({
            useCleanCache: true,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
        try {
            index = require('../lib/index.js');
        } catch(e){
            console.error(e.stack);
            throw e;
        }
        done();
    });

    after(function(done){
        mockery.deregisterAll();
        mockery.disable();
        done();
    });

    it('should export and object with methods', function(done){
        assert.equal(typeof index, 'object');
        ['start', 'defaults', 'change', 'run', 'clean', 'updateIndex'].forEach(function(name) {
            assert.equal(typeof index[name], 'function');
        });
        done();
    });

    it('start method should call run, clean and defaults', function(done){
        var data = {},
        hold = {};
        ['run', 'clean', 'defaults'].forEach(function(name) {
            hold[name] = index[name];
            index[name] = function(callback) {
                data[name] = true;
                if (callback) { callback(); }
            };
        });
        index.start();
        Object.keys(hold).forEach(function(name) {
            index[name] = hold[name];
        });
        assert.equal(typeof data, 'object');
        assert(data.run);
        assert(data.clean);
        assert(data.defaults);
        done();
    });

    it('clean method should do nothing without config', function(done){
        var unlinked;
        fs.unlink = function(x, cb){
            unlinked = x;
            cb();
        };
        index.clean(function(err){
            assert.ifError(err);
            assert(!unlinked);
            done();
        });
    });

    it('clean method with options should unlink file', function(done){
        fs.oldUnlink = fs.unlink;
        var unlinked;
        fs.unlink = function(x, cb){
            unlinked = x;
            cb();
        };
        CLEAN = true;
        index.clean(function(err){
            assert.ifError(err);
            CLEAN = false;
            assert.equal(unlinked, 'seqfile');
            done();
        });
    });

    it('run method should execute', function(done){
        index.setTimer = noop;
        index.run();
        assert.equal(called.follow, 1);
        assert.ok(CONF);
        assert.equal(typeof CONF.handler, 'function');
        CONF = undefined;
        done();
    });

    it('run method with since should execute', function(done){
        SINCE = 12345;
        index.setTimer = noop;
        index.run();
        assert.equal(called.follow, 2);
        assert.ok(CONF);
        assert.equal(typeof CONF.handler, 'function');
        assert.equal(CONF.since, 12345);
        CONF = undefined;
        done();
    });

    it('updateIndex method should do its thing', function(done){
        index.updateIndex({
            json: {
                name: 'foo'
            }
        }, function() {
            var result = JSON.parse(memblob.data['-/index.json']);
            memblob.data = {};
            assert.equal(result.couchdb, 'Welcome');
            assert.equal(result.processing, 'foo');
            done();
        });
    });

    it('defaults method', function(done){
        var skipped = [];
        var opts = {
            blobstore: require('abstract-blob-store')(),
            error: path.resolve('./defaults/404.json'),
            index: path.resolve('./defaults/index.json')
        };
        index.defaults(opts, function(err, data){
            if (err) {
                return done(err);
            }
            skipped.push(data);
            opts.blobstore.data = {'-/index.json': 'asdf'};
            index.defaults(opts, function(err, data){
                if (err) {
                    return done(err);
                }
                skipped.push(data);
                assert(skipped[0]); // not skipped
                assert(!skipped[1]); // skipped
                done();
            });
        });
    });

    it('change method', function(done){
        index.change({
            json: {
                name: 'bar',
                versions: {}
            },
            versions: ['']
        }, function() {
            var d = JSON.parse(memblob.data['-/index.json']);

            assert.equal(d.couchdb, 'Welcome');
            assert.equal(d.processing, 'bar');
            assert.equal(called.saveTarballs, 1);
            assert.equal(called.saveJSON, 1);
            done();
        });
    });

    it('change method when bad JSON is provided', function(done){
        var oldCalled = called;
        called = {};
        index.change({json: '<xml>not json</xml>'}, function(err){
            var newCalled = called;
            called = oldCalled;
            assert.deepEqual({}, newCalled);
            done();
        });
    });

    it('change method checks for scoped dependencies', function(done){
        index.change({
            json: {
                name: 'bar',
                'dist-tags' : {
                    latest: '1.0.0'
                },
                versions: {}
            },
            versions: [
                {
                    json: {
                        version: '1.0.0',
                        dependencies: {
                            'foo-one': '1.0.0',
                            '@bar/one': '1.0.0'
                        },
                        devDependencies: {
                            'foo-two': '1.0.0',
                            '@bar/two': '1.0.0'
                        },
                        optionalDependencies: {
                            'foo-three': '1.0.0',
                            '@bar/three': '1.0.0'
                        }
                    }
                }
            ]
        }, function() {
            assert.deepEqual(oneData, ['@bar/one', '@bar/two', '@bar/three']);
            done();
        });
    });
});
