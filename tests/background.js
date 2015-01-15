var vows = require('vows'),
    mockery = require('mockery'),
    assert = require('assert');

var startCalled = false;

mockery.registerMock('./index', {
    start: function () {
        assert.equal(arguments.length, 0);
        startCalled = true;
    }
});

var tests = {
    'requires index': {
        topic: function () {
            mockery.enable();
            require('../lib/background');
            mockery.disable();
            return startCalled;
        },
        'and calls start': function(d){
            assert(d);
        }
    }
};

vows.describe('background').addBatch(tests).export(module);

