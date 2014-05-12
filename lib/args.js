/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var davargs = require('davargs');
var path = require('path');
var os = require('os');
var log = require('davlog');

davargs.init({
    known: {
        report: path,
        since: Number,
        spawn: Number,
        check: Boolean,
        registry: String,
        tarballs: Boolean,
        limit: Number,
        clone: Boolean,
        index: path,
        error: path,
        clean: Boolean,
        tmp: path,
        dir: path,
        domain: String,
        version: Boolean,
    },
    shorts: {
        s: ['--spawn'],
        n: ['--limit'],
        o: ['--dir'],
        t: ['--tmp'],
        d: ['--domain'],
        v: ['--version']
    }
});

module.exports = function() {
    var options = davargs.parse(process.argv);
    options.tmp = options.tmp || os.tmpdir();
    options.index = options.index || path.join(__dirname, '../defaults', 'index.json');
    options.error = options.error || path.join(__dirname, '../defaults', '404.json');
    options.seqFile = path.join(options.tmp, 'registry-static.seq');
    options.limit = options.limit || 10;
    options.spawn = options.spawn || 20;
    options.registry = options.registry || 'http://registry.npmjs.org/';

    if (options.version || options.help) {
        return options;
    }

    if (!options.domain && !options.check) {
        log.err('Domain rewrite url not provided, try --help');
        process.exit(250);
    }
    if (!options.dir) {
        log.err('Output directory not found, try --help');
        process.exit(250);
    }
    return options;
};
