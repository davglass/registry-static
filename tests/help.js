var vows = require('vows'),
    assert = require('assert');

var log = console.log;

var tests = {
    'help': {
        topic: function() {
            var data;
            console.log = function(str) {
                data = str;
            };
            require('../lib/help');
            console.log = log;
            return data;
        },
        'should print': function(d) {
            assert.ok(d);
            assert.isTrue(d.indexOf('registry-static@') > -1);
        }
    }
};

vows.describe('help').addBatch(tests).export(module);
