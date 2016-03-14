var request = require('supertest');
var mockery = require('mockery');
var assert = require('assert');

describe('http', function() {
    var app, log = [];
    before(function(){
        process.registryStaticStats = {
            foo: 1,
            bar: 'two'
        };
        mockery.registerMock('./logger', {
            err: function(msg) { log.push(msg); }
        });
        mockery.registerMock('./one', function(name, cb) {
            setImmediate(function(){
                if (name === 'bad') {
                    cb({stack: 'fake error stack'});
                } else {
                    cb();
                }
            });
        });
        mockery.registerMock('./args', {
            httpport: 8888
        });
        mockery.enable({
            useCleanCache: true,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
        app = require('../lib/http')();
    });
    after(function(){
        mockery.deregisterAll();
        mockery.disable();
    });

    describe('stats.json', function(){
        it('works', function(done){
            request(app).get('/stats.json')
                .expect('Content-Type', /json/)
                .expect(200, {
                    foo: 1,
                    bar: 'two'
                }, done);
        });
    });

    describe('syncone.json', function(){
        it('works', function(done){
            request(app).get('/syncone.json?name=good')
                .expect('Content-Type', /json/)
                .expect(200, {
                    success: true
                }, done);
        });
        it('fails correctly on failing module', function(done){
            request(app).get('/syncone.json?name=bad')
                .expect('Content-Type', /json/)
                .expect(500, {
                    success: false, 
                    error: 'see log'
                }, function(err){
                    if (err) return done(err);

                    assert(log.length === 2);
                    assert(log[0] === 'Could not sync bad');
                    assert(log[1] === 'fake error stack');
                    done();
                });
        });
        it('fails correctly on bad input', function(done){
            request(app).get('/syncone.json')
                .expect('Content-Type', /json/)
                .expect(400, {
                    success: false,
                    error: 'need a name'
                }, done);
        });
    });
});
