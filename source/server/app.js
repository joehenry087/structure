var express = require('express');
var app = express();
var router = express.Router();
var path = require('path');

app.use(express.static(path.join(__dirname, './frontend')));

router.get('/test', function(req, res) {
    res.send('hello');
});

app.use(router);

app.listen(8080, () => console.log('Server started!'));