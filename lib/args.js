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
options.help('help');
options.usage('registry-static@' + require('../package').version);
options.example('registry-static -d my.registry.com -o /var/www/registry', '');
options.example('registry-static -c /path/to/myconfig.json', '');
options.describe('config', 'Use a config file');
options.describe('domain', 'The domain replacer                                 [required]');
options.describe('dir', 'The output directory                                [required]');
options.describe('registry', 'The registry to mirror from');
options.describe('limit', 'Limit the number of concurrent downloads');
options.describe('user', 'Set the user that this process should change to');
options.describe('group', 'Set the group that this process should change to');
options.describe('hooks', 'Provide a hooks module.');
options.describe('clean', 'Clear the sequance file');
options.describe('log', 'The file to log the output to');
options.describe('quiet', 'Turn down the logger');
options.describe('index', 'An index.json for the whole registry');
options.describe('error', 'A 404 file');
options.describe('replport', 'Port to listen on for REPL');
options.describe('httpport', 'Port to listen on for HTTP API');
options.describe('one', 'Sync only the provided package, right now, then quit');

//Check arg types
options.string('hooks user group log registry index error tmp dir domain'.split(' '));
options.boolean('restart tarballs clone clean version quiet'.split(' '));

//Allow config file
options.config('config');
options.config('c');

//Aliases
options.alias('help', 'h');
options.alias('user', 'u');
options.alias('group', 'g');
options.alias('spawn', 's');
options.alias('limit', 'l');
options.alias('dir', 'o');
options.alias('tmp', 't');
options.alias('domain', 'd');
options.alias('version', 'v');

//Defaults
options.default('spawn', 20);
options.default('limit', 10);
options.default('registry', 'https://registry.npmjs.org/');
options.default('tmp', os.tmpdir());
options.default('index', path.join(__dirname, '../defaults', 'index.json'));
options.default('error', path.join(__dirname, '../defaults', '404.json'));

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

if (!options.version && !options.help && !options.restart) {
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
