var net = require("net");
var repl = require("repl");
var fs = require('fs');
var path = require('path');
var options = require('./args');
var slice = require('slice-file');

var ctrlC = new Buffer([ 255, 244, 255, 253, 6 ]).inspect();

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
    if (!options.log) {
        this.outputStream.write("\nThe `log()` command only works when registry-static is invoked with a `--log` argument\n");
        this.displayPrompt();
    } else {
        var tail = slice(options.log);
        tail.follow(-10).pipe(this.outputStream);

        // outputSteam on data?? yes. it's the socket.
        this.outputStream.on('data', function dataListener(data){
            // otherwise the repl gets into a weird state
            if (ctrlC === data.inspect()) {
                tail.close();
            }
        });
    }
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
