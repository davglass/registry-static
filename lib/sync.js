var fs = require('graceful-fs'),
    path = require('path'),
    log = require('davlog'),
    request = require('request'),
    check = require('./util').check,
    async = require('async');


var sync = function(options) {
    console.log(options);

    var scan = function(dir, callback) {
        var base = path.join(options.dir, dir, 'index.json');
        fs.readFile(base, 'utf8', function(err, data) {
            if (err) {
                return callback(null, null);
            }
            var json = JSON.parse(data),
                latest,
                url = options.registry + json.name;
            if (json['dist-tags']) {
                latest = json['dist-tags'].latest;
            }
            log.info('GET', url);
            request({
                url: url,
                json: true,
                headers: {
                    'user-agent': 'registry static mirror worker'
                }
            }, function(err, res, body) {
                log.info(res.statusCode, url);
                if (res.statusCode !== 200) {
                    return callback(null, null);
                }
                if (latest && body && body['dist-tags'] && body['dist-tags'].latest === latest) {
                    log.info(json.name, 'is up to date, skipping..');
                    return callback(null, null);
                }
                log.warn(json.name, 'is out of sync, saving new index');
                fs.writeFile(base, JSON.stringify(body, null, 4), 'utf8', function() {
                    check(body, options, callback);
                });
            });
        });
    };

    fs.readdir(options.dir, function(err, dirs) {
        async.eachLimit(dirs, options.limit, scan, function() {
            console.log(arguments);
        });
    });
};

module.exports = sync;
