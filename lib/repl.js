var net = require("net");
var repl = require("repl");
var fs = require('fs');
var path = require('path');
var logger = require('./logger');
var log = require('davlog');
var options = require('./args');
var one = require('./one');

var pipedStreams = [];

function liveLog() {
    pipedStreams.push(this.outputStream);
    logger.writer.pipe(this.outputStream);
}

var logDef = {
    help: 'live logs',
    action: liveLog
};

module.exports = function () {
    net.createServer(function (socket) {
        var thisOutputStream;
        socket.write('\n.help for help\n');
        socket.on('error', function(e){
            log.info('repl client has disconnected');
            if (thisOutputStream) {
                logger.writer.unpipe(thisOutputStream);
            }
        });
        var telnetRepl = repl.start({
            prompt: "registry-static > ",
            input: socket,
            output: socket,

        }).on('exit', function() {
            log.info('repl client has disconnected');
            if (thisOutputStream) {
                logger.writer.unpipe(thisOutputStream);
            }
            socket.end();
        });

        // defineCommand gives us .commands
        telnetRepl.defineCommand('log', {
            help: 'live logs',
            action: function liveLog() {
                thisOutputStream = this.outputStream;
                logger.writer.pipe(this.outputStream);
            }
        });
        telnetRepl.context.one = function(name) {
            one(name, function(err) {
                if (err) {
                    return console.log(err.stack);
                }
            });
        };
    }).listen(options.replport);
};
