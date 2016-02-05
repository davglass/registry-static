/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var path = require('path');
var os = require('os');
var log = require('davlog');
var fs = require('fs');
var yargs = require('yargs');

//hack in a default config. no need after https://github.com/chevex/yargs/pull/75
/*istanbul ignore next this is a temp hack*/
if (process.argv.indexOf('--config') === -1 && process.argv.indexOf('-c') === -1) {
    var defaultConfig = path.resolve(path.dirname(process.execPath), '../etc/registry-static/config.json');
    if (fs.existsSync(defaultConfig)) {
        process.argv.push('--config');
        process.argv.push(defaultConfig);
    }
}

var options = yargs(process.argv);

//Usage
options.usage('registry-static@' + require('../package').version);
options.example('registry-static -d my.registry.com -o /var/www/registry', '');
options.example('registry-static -c /path/to/myconfig.json', '');
options.help('help');
options.alias('help', 'h');
options.describe('config', 'Use a config file');
options.config('config');
options.config('c');
var defs = {
    domain: { alias: 'd', describe: 'The domain replacer                                 [required]', type: 'string' },
    dir: { alias: 'o', describe: 'The output directory                                [required]', type: 'string' },
    registry: { describe: 'The registry to mirror from', default: 'http://registry.npmjs.org/', type: 'string' },
    limit: { alias: 'l', describe: 'Limit the number of concurrent downloads', default: 10 },
    user: { alias: 'u', describe: 'Set the user that this process should change to', type: 'string' },
    group: { alias: 'g', describe: 'Set the group that this process should change to', type: 'string' },
    hooks: { describe: 'Provide a hooks module.', type: 'string' },
    clean: { describe: 'Clear the sequance file', type: 'boolean' },
    log: { describe: 'The file to log the output to', type: 'string' },
    quiet: { describe: 'Turn down the logger', type: 'boolean' },
    index: { describe: 'An index.json for the whole registry', default: path.join(__dirname, '../defaults', 'index.json'), type: 'string' },
    error: { describe: 'A 404 file', default: path.join(__dirname, '../defaults', '404.json'), type: 'string' },
    replport: { describe: 'Port to listen on for REPL' },
    one: { describe: 'Sync only the provided package, right now, then quit', type: 'string' },
    tmp: { alias: 't', describe: 'Temp directory, for storing sequence file', default: os.tmpdir(), type: 'string' },
    version: { alias: 'v', describe: 'Show version, then quit', type: 'boolean' }
};
Object.keys(defs).forEach(function(k){ options.option(k, defs[k]); });

options = options.argv;

if (options.version) {
    var version = require('../package.json').version;
    console.log(version);
    process.exit(1);
}

//This one isn't configurable.
options.seqFile = path.join(options.tmp, 'registry-static.seq');

if (options.user) {
    //Not wrapping this, if it throws, it throws..
    process.setuid(options.user);
}

if (options.group) {
    //Not wrapping this, if it throws, it throws..
    process.setgid(options.group);
}

if (!options.version && !options.help) {
    if (!options.domain && !options.check) {
        log.err('Domain rewrite url not provided, try --help');
        process.exit(1);
    }
    if (!options.dir) {
        log.err('Output directory not found, try --help');
        process.exit(1);
    }
} //otherwise we're not actually running, so don't bother with the checks

if (options.blobstore) {
    options.blobstore = require(options.blobstore);
} else {
    options.blobstore = require('fs-blob-store')(options.dir);
}

if (options.hooks) {
    //Not wrapping this, if it throws, it throws..
    options.hooks = require(options.hooks);
} else {
    options.hooks = {};
}

module.exports = options;
