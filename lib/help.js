/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var version = require('../package.json').version;
var help = [
    'registry-static@' + version,
    '',
    '   --domain/-d     The domain replacer',
    '   --dir/-o        The output directory',
    '   --limit/-n      Limit the number of concurrent downloads (10)',
    '   --spawn/-s      The number of times a spawn happens before the process exits (20)',
    '',
    '   --clean         Clear the sequance file',
    '   --check         Crawl the tarballs and check all of their shasums',
    '   --report <file> Used with --check, write a json report for all missing files',
    '',
    '   --restart   Restart the child process, in case it is stuck',
    '',
];

console.log(help.join('\n'));
