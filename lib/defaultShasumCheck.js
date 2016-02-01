var crypto = require('crypto');
var miss = require('mississippi');

function defaultShasumCheck(info, callback) {
    var options = this.options;
    var log = this.log;
    var shasum = crypto.createHash('sha1');
    shasum.setEncoding('hex');
    miss.pipe(options.blobstore.createReadStream(info.tarball), shasum, function(e) {
        if (e) {
            // There are some totally crap situations where the tarball
            // path is something silly, like a directory, but still a
            // path on the filesystem, so `exists` passes. Ignore and continue.
            log.err('failed to read from path which supposedly exists:', info.path);
            log.err(e.stack);
            return callback(null, true);
        }
        shasum.end();
        var d = shasum.read();
        if (info.shasum !== d) {
            info.error = {
                found: d,
                expected: info.shasum
            };
            log.err('shasum check failed for', info.path);
            log.err('found', d, 'expected', info.shasum);
            return callback();
        }
        log.info('shasum check passed for', info.path, '(' + info.shasum + ')');
        callback(null, true);
    });
}

module.exports = defaultShasumCheck;
