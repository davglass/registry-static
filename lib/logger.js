var log = require('davlog');
var mkdirp = require('mkdirp');
var fs = require('fs');
var path = require('path');
var options = require('./args');

var logger;

function newLogger() {
    var outStream = process.stdout;
    var errStream = process.stderr;
    if (options.log) {
        mkdirp.sync(path.dirname(options.log));
        outStream = fs.createWriteStream(options.log, { flags: 'a' });
        errStream = outStream;
    }
    var logInit = {
        name: 'static',
        timestamps: true,
        stdout: outStream,
        stderr: errStream
    };
    if (options.log) {
        logInit.color = false;
    }
    logger = log.init(logInit);
    if (options.quiet) {
        logger.quiet();
    }
}

function getLogger() {
    if (!logger) {
        newLogger();
    }
    return logger;
}

function restart () {
    logger.stdout.end();
    if (logger.stderr !== logger.stdout) {
        logger.stderr.end();
    }
    newLogger();
}


/*istanbul ignore next ignoreing the call, but testing the method*/
process.on('SIGPIPE', restart);

module.exports = getLogger();
module.exports.restart = restart;
