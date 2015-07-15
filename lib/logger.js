var strip = require('strip-ansi');
var log = require('davlog');
var mkdirp = require('mkdirp');
var fs = require('fs');
var path = require('path');
var Transform = require('stream').Transform;

log.init({
    name: 'static',
    timestamps: true
});

var options = require('./args');

if (options.quiet) {
    log.quiet();
}

var create = function(isFile) {
    var passthrough = new Transform();
    passthrough._transform = function(data, encoding, cb){
        cb(null, data);
    };


    if (options.log) {
        mkdirp.sync(path.dirname(options.log));
        var fStream = fs.createWriteStream(options.log, { flags: 'a' });
        passthrough.pipe(fStream);
    } else {
        passthrough.pipe(process.stdout);
    }
    logger.writer = passthrough;
};

var logger = function() {
    create();
    var write = function() {
        var args = Array.prototype.slice.call(arguments, 0);
        var line = args.join(' ') + '\n';
        if (options.log) {
            line = strip(line);
        }
        logger.writer.write(line);
    };
    log.logFn = write;
    log.errFn = write;
};

var restart = function() {
    log.info('restarting logging service');
    logger.writer.end();
    create();
};
logger.restart = restart;

/*istanbul ignore next ignoreing the call, but testing the method*/
process.on('SIGPIPE', restart);

module.exports = logger;
