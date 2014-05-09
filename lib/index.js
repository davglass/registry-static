var follow = require('follow-registry');
var patch = require('patch-package-json');
var files = require('./files.js');
var path = require('path');
var fs = require('graceful-fs');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var log = require('davlog');
var timethat = require('timethat').calc;

log.init({
    name: 'static'
});

var args = require('./args.js');
var options = args();

if (options.version) {
    console.log(require('../package.json').version);
    process.exit(250);
}

if (options.help) {
    require('./help');
    process.exit(250);
}

var updateIndex = function(data, callback) {
    var index = path.join(options.dir, 'index.json');
    fs.readFile(index, 'utf8', function(err, d) {
        if (d) {
            var json = JSON.parse(d);
            json.domain = options.domain;
            json.dir = options.dir;
            json.uptime = process.uptime();
            json.node = process.version;
            json.sequence = data.seq;
            json.date = Date.now() / 1000;
            return fs.writeFile(index, JSON.stringify(json, null, 4), 'utf8', callback);
        }
        callback();
    });
};

//This pauses the feed until callback is executed
var change = function(data, callback) {
    var changeStart = new Date();
    var json = patch.json(data.json, options.domain);
    if (!json.name) {
        //Bail, something is wrong with this change
        return callback();
    }
    log.info('[' + data.seq + '] processing', json.name);
    if (!data.versions.length) {
        return callback();
    }
    data.versions.forEach(function(item) {
        item.json = patch.json(item.json, options.domain);
    });
    updateIndex(data, function() {
        files.saveTarballs(data.tarballs, function() {
            files.saveJSON(data, function(err) {
                if (err) {
                    log.err(err);
                    return callback();
                }
                var num = Object.keys(json.versions).length;
                log.info('[' + data.seq + '] done processing', num, 'version' + ((num > 1) ? 's' : '') + ' of', json.name, 'in', timethat(changeStart));
                callback();
            });
        });
    });
};

var defaults = function(callback) {
    mkdirp(options.dir, function() {
        var index = fs.createWriteStream(path.join(options.dir, 'index.json'));
        var error = fs.createWriteStream(path.join(options.dir, '404.json'));
        log.info('Writing index.json');
        fs.createReadStream(options.index)
            .on('end', function() {
                log.info('Writing 404.json');
                fs.createReadStream(options.error)
                    .on('end', callback)
                    .pipe(error);
            })
            .pipe(index);
    });
};

var clean = function(callback) {
    if (!options.clean) {
        return callback();
    }
    var start = new Date();
    log.warn('cleaning data');
    log.info('Deleting', options.seqFile);
    fs.unlink(options.seqFile, function() {
        log.info('Deleting', options.dir, '(this may take a while..)');
        rimraf(options.dir, function() {
            log.warn('finished cleaning in', timethat(start));
            callback();
        });
    });
};


var start = function() {
    if (options.check) {
        return require('./check.js');
    }
    clean(function() {
        defaults(function() {
            if (options.clone) {
                var clone = require('./clone.js');
                clone(options);
                return;
            }
            log.info('[' + process.env.PROC_SPAWN + '] starting to follow registry with these options:');
            console.log('   domain %s', options.domain);
            console.log('   directory %s', options.dir);
            console.log('   tmp %s', options.tmp);
            console.log();
            follow({
                seqFile: options.seqFile,
                handler: change
            });
        });
    });
};

module.exports = start;
