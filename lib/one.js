var request = require('request');
var url = require('url');
var patch = require('patch-package-json');
var files = require('./files');
var options = require('./args');

module.exports = function one(name, cb){
    request.get('https://registry.npmjs.org/'+name, {json: true}, function(err, res, body){
        if (err) {
            return cb(err);
        }
        if (res.statusCode !== 200) {
            return cb(new Error('npm responded with status code: '+res.statusCode));
        }
        var data = {
            json: body,
            versions: [],
            tarballs: []
        };
        if (body.versions) {
            if (body['dist-tags']) {
                Object.keys(body['dist-tags']).forEach(function(tag){
                    data.versions.push({version: tag, json: body.versions[body['dist-tags'][tag]]});
                });
            }
            Object.keys(body.versions).forEach(function(ver){
                body.versions[ver] = patch.json(body.versions[ver], options.domain);
                data.versions.push({version: ver, json: body.versions[ver]});
                data.tarballs.push({
                    path: url.parse(body.versions[ver].dist.tarball).path,
                    tarball: body.versions[ver].dist.tarball,
                    shasum: body.versions[ver].dist.shasum
                });
            });
        }
        files.saveTarballs(data.tarballs, function(){
            files.saveJSON(data, cb);
        });
    });
};
