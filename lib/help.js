/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var version = require('../package.json').version;
var help = [
    'registry-static@' + version,
    '',
    '   --config/-c     Use a config file',
    '',
    '   --domain/-d     The domain replacer',
    '   --dir/-o        The output directory',
    '   --limit/-n      Limit the number of concurrent downloads (10)',
    '   --spawn/-s      The number of times a spawn happens before the process exits (20)',
    '   --user/-u       Set the user that this process should change to',
    '   --group/-g      Set the group that this process should change to',
    '   --hooks         Provide a hooks module.',
    '',
    '   --clean         Clear the sequance file',
    '   --check         Crawl the tarballs and check all of their shasums',
    '   --sync          Crawl the json files and look for outdated index files',
    '   --report <file> Used with --check, write a json report for all missing files',
    '',
    '   --restart       Restart the child process, in case it is stuck',
    '',
    '   --log <file>    The file to log the output to',
    '   --quiet         Turn down the logger',
    '',
];

console.log(help.join('\n'));
