var vows = require('vows'),
    mockery = require('mockery'),
    assert = require('assert');

var startCalled = false;



var tests = {
    'requires index': {
        topic: function () {
            mockery.enable({
                useCleanCache: true,
                warnOnReplace: false,
                warnOnUnregistered: false
            });
            mockery.registerMock('./index', {
                start: function () {
                    assert.equal(arguments.length, 0);
                    startCalled = true;
                }
            });
            require('../lib/background');
            mockery.deregisterAll();
            mockery.disable();
            return startCalled;
        },
        'and calls start': function(d){
            assert(d);
        }
    }
};

vows.describe('background').addBatch(tests).export(module);

