'use strict';

var express = require('express'),
    routes = require('./app/routes/index.js'),
    mongo = require('mongodb').MongoClient,
    multer = require('multer');

var bodyParser = require('body-parser');

const favicon = require('serve-favicon');
const path = require('path');

// v Stuff for passport
var cookieParser = require('cookie-parser');
var methodOverride = require('method-override');

// set up database for express session
var mongoose = require('mongoose');

var config = require('./app/config');

//var jquery = require('jquery');
//var bootstrap = require('bootstrap');

var app = express();

app.set('view engine', 'pug');
app.set('views', './views');

app.use(methodOverride());
app.use(cookieParser());

app.use(bodyParser.json({ limit: '80mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(require('express-log-url'));

mongo.connect(process.env.MONGO_STRING, {
    useUnifiedTopology: true 
}, function(err, db) {
    if (err) {
        console.log(process.env.MONGO_STRING);
        throw new Error('Database failed to connect!');
    } else {
        console.log('MongoDB successfully connected on port 27017.');
    }

    app.use('/public', express.static(process.cwd() + '/public'));
    app.use('/controllers', express.static(process.cwd() + '/app/controllers'));
    app.use('/helpers', express.static(process.cwd() + '/app/helpers'));

    routes(app, db);

    app.listen(process.env.PORT || 3000, function () {
        console.log('Listening on port 3000...');
    });

});