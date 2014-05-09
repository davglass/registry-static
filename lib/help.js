/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var version = require('../package.json').version;
var help = [
    'registry-static@' + version,
    '',
    '   --domain/-d The domain replacer',
    '   --dir/-o    The output directory',
    '   --limit/-n  Limit the number of concurrent downloads (10)',
    '',
    '   --clean     Clear the sequance file',
    '   --check     Crawl the tarballs and check all of their shasums',
    '',
];

console.log(help.join('\n'));
