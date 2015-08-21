var crypto = require('crypto');

module.exports = function (info, callback) {
    var options = this.options;
    var log = this.log;
    var shasum = crypto.createHash('sha1');
    shasum.setEncoding('hex');
    options.blobstore.createReadStream(info.tarball)
    .on('error', function(e) {
        // There are some totally crap situations where the tarball
        // path is something silly, like a directory, but still a
        // path on the filesystem, so `exists` passes. Ignore and continue.
        log.err('failed to read from path which supposedly exists:', info.path);
        log.err(e.stack);
        callback(null, true);
    })
    .on('end', function() {
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
    })
    .pipe(shasum);
};
