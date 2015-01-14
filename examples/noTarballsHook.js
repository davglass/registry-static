/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
exports.tarball = function(options, data, callback) {
    // Because this doesn't explicitly provide a truthy second arg,
    // it will not download and save the tarball.
    callback();
}
