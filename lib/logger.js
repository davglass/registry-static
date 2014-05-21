var strip = require('strip-ansi');
var log = require('davlog');
var mkdirp = require('mkdirp');
var fs = require('fs');
var path = require('path');

log.init({
    name: 'static'
});

var args = require('./args.js');
var options = args();
var writer;

var create = function() {
    writer = fs.createWriteStream(options.log, { flags: 'a' });
};

var logger = function() {
    if (options.log) {
        mkdirp.sync(path.dirname(options.log));
        create();
        var write = function() {
            var args = Array.prototype.slice.call(arguments, 0);
            var line = strip(args.join(' ')) + '\n';
            writer.write(line);
        };
        log.logFn = write;
        log.errFn = write;
    }
};

var restart = function() {
    log.info('restarting logging service');
    writer.end();
    create();
};

process.on('SIGPIPE', restart);


module.exports = logger;
