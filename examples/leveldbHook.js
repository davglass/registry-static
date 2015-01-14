/**
 *
 */
/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var level = require('level-party');

var db = level('./npm.db', {valueEncoding: 'json'});

exports.versionJson = function(data, callback) {
    db.put(data.json.name+'@'+data.version, data.json, function (err) {
        if (err) return callback(err);
        //Swallow errors for now. This is just an example.

        //Call with "true" since we still want to save the json files.
        callback(null, true);
    });
};

exports.indexJson = function(data, callback) {
    db.put(data.json.name, data.json, function (err) {
        if (err) return callback(err);
        //Swallow errors for now. This is just an example.

        //Call with "true" since we still want to save the json files.
        callback(null, true);
    });
};
