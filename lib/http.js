var app = require('express')();
var one = require('./one');
var log = require('./logger');
var options = require('./args');

app.get('/stats.json', function stats(req, res) {
    res.json(process.registryStaticStats);
});

app.get('/syncone.json', function syncone(req, res) {
    if (typeof req.query.name !== 'string') {
        return res.status(400).json({success: false, error: 'need a name'});
    }
    one(req.query.name, function(err) {
        if (err) {
            log.err('Could not sync '+req.query.name);
            log.err(err.stack);
            return res.status(500).json({success: false, error: 'see log'});
        }
        res.json({success: true});
    });
});

module.exports = function repl() {
    app.listen(options.httpport);
    return app;
};
