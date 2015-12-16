var url = require('url'),
    verify = require('./verify.js').verify,
    path = require('path'),
    async = require('async');

function check(o, options, callback) {
    if (!o.versions) {
        return callback();
    }
    var tarballs = [];
    Object.keys(o.versions).forEach(function(version) {
        var info = o.versions[version];
        if (info.dist && info.dist.tarball && info.dist.shasum) {
            var u = url.parse(info.dist.tarball);
            tarballs.push({
                path: u.pathname,
                tarball: path.join(u.pathname),
                shasum: info.dist.shasum
            });
        }
    });
    if (!tarballs.length) {
        return callback();
    }
    async.eachLimit(tarballs, options.limit, verify, function() {
        callback(null, tarballs);
    });
}

exports.check = check;
