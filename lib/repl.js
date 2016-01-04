var net = require("net");
var repl = require("repl");
var fs = require('fs');
var path = require('path');
var log = require('./logger');
var options = require('./args');
var one = require('./one');

function unpipe(strm) {
    log.info('repl client has disconnected');
    if (strm) {
        log.stdout.unpipe(strm);
        if (log.stdout !== log.stderr) {
            log.stderr.unpipe(strm);
        }
    }
}

function replSocketHandler(socket) {
    var thisOutputStream;
    socket.write('\n.help for help\n');
    socket.on('error', function(){
        unpipe(thisOutputStream);
    });
    var telnetRepl = repl.start({
        prompt: "registry-static > ",
        input: socket,
        output: socket
    }).on('exit', function() {
        unpipe(thisOutputStream);
        socket.end();
    });

    // defineCommand gives us .commands
    telnetRepl.defineCommand('log', {
        help: 'live logs',
        action: function liveLog() {
            thisOutputStream = this.outputStream;
            log.stdout.pipe(thisOutputStream);
            if (log.stdout !== log.stderr) {
                log.stderr.pipe(thisOutputStream);
            }
        }
    });
    telnetRepl.defineCommand('one', {
        help: 'sync one package (e.g. `.one async`)',
        action: function(name) {
            var self = this;
            one(name, function(err) {
                if (err) {
                    self.outputStream.write("`one('"+name+"')` did not complete successfully. It gave the following error:\n");
                    self.outputStream.write(err.stack);
                    self.outputStream.write('\n');
                } else {
                    self.outputStream.write("`one('"+name+"')` completed successfully.\n");
                }
                self.displayPrompt();
            });
            self.outputStream.write("`one('"+name+"')` is now running...\n");
        }
    });
}

module.exports = function repl() {
    net.createServer(replSocketHandler).listen(options.replport);
};
