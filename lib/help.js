var version = require('../package.json').version;
var help = [
    'registry-static@' + version,
    '',
    '   --domain/-d The domain replacer',
    '   --dir/-o    The output directory',
    '   --limit/-n  Limit the number of concurrent downloads (10)',
];

console.log(help.join('\n'));
