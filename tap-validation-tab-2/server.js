'use strict';

var express = require('express'),
    routes = require('./app/routes/index.js'),
    mongo = require('mongodb').MongoClient;

var bodyParser = require('body-parser');

//var jquery = require('jquery');
//var bootstrap = require('bootstrap');

var app = express();

app.set('view engine', 'pug');
app.set('views', './views');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const request = require('request');

app.use(require('express-log-url'));

// Local
//mongo.connect('mongodb://localhost:27017/clementinejs', function (err, db) {

console.log("TEST_VAR on server side is: " + process.env.TEST_VAR);



// Production
mongo.connect(process.env.MONGO_STRING, function (err, db) {
    if (err) {
        console.log(process.env.MONGO_STRING);
        throw new Error('Database failed to connect!');
    } else {
        console.log('MongoDB successfully connected on port 27017.');
    }

    app.use('/public', express.static(process.cwd() + '/public'));
    app.use('/controllers', express.static(process.cwd() + '/app/controllers'));

    routes(app, db);

    app.listen(process.env.PORT || 3000, function () {
        console.log('Listening on port 3000...');
    });

});