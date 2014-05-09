var davargs = require('davargs');
var path = require('path');
var os = require('os');
var log = require('davlog');

davargs.init({
    known: {
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
    options.registry = options.registry || 'http://registry.npmjs.org/';

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
