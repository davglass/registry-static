var net = require("net");
var repl = require("repl");
var fs = require('fs');
var path = require('path');
var logger = require('./logger');
var options = require('./args');

function bounce() {
    var pidFile = path.join(options.tmp, 'registry-static.pid');
    var self = this;
    fs.readFile(pidFile, 'utf8', function(err, pid){
        self.outputStream.write('Restarting process: '+pid+'\n');
        process.kill(pid, 'SIGHUP');
        self.displayPrompt();
    });
}

var bounceDef = {
    help: 'bounce the child process',
    action: bounce
};

function liveLog() {
    logger.writer.pipe(this.outputStream);
}

var logDef = {
    help: 'live logs',
    action: liveLog
};

module.exports = function () {
    net.createServer(function (socket) {
        socket.write('\n.help for help\n');
        var telnetRepl = repl.start({
            prompt: "registry-static > ",
            input: socket,
            output: socket
        }).on('exit', function() {
            socket.end();
        });

        // defineCommand gives us .commands
        telnetRepl.defineCommand('restart', bounceDef);
        telnetRepl.defineCommand('bounce', bounceDef);
        telnetRepl.defineCommand('log', logDef);
    }).listen(options.replport);
};
