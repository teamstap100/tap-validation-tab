'use strict';

// App Insights startup
var TVT_APPINSIGHTS_KEY = process.env["TVT_APPINSIGHTS_KEY"];

if (process.env["ENV"] == "PROD") {
    const appInsights = require('applicationinsights');
    appInsights.setup(TVT_APPINSIGHTS_KEY).start();
}


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

// New static file-serving
const serveStatic = require('serve-static');

const { getSecret } = require('./app/helpers/helpers.server');

var app = express();

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))


app.set('view engine', 'pug');
app.set('views', './views');

app.use(methodOverride());
app.use(cookieParser());

app.use(bodyParser.json({ limit: '80mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(require('express-log-url'));

/*
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
*/

function fetchSecrets(callback) {
    console.log("Called fetchSecrets");
    // Fetch all secrets from the vault and put them in environment variables.
    function checkIfDone() {
        console.log(`${secretsFetched} / ${secrets.length} secrets fetched`);
        if (secretsFetched >= secrets.length) {
            return callback();
        }
    }

    var secretsFetched = 0;
    var secrets = [
        "MONGO-CONNECTION-STRING",
        "TEAMS-ADO-PAT",
    ];

    secrets.forEach(function (secretName) {
        getSecret(secretName, function (secretData) {
            try {
                let secretValue = JSON.parse(secretData).value;
                process.env[secretName] = secretValue;
            } catch (e) {
                console.log("Something is wrong with the return value for " + secretName);
            }

            secretsFetched++;
            checkIfDone();
        }, function (err) {
            console.log("Something went wrong while fetcing " + secretName);
            secretsFetched++;
            checkIfDone();
        });
    });
}

function startApp() {
    if ((process.env.ENV == "PROD") || (process.env.ENV == "STAGING")) {
        console.log("Fetching secrets");
        // In production, use connection string from Azure vault

        // Get secrets from Azure Key Vault and put them in environment variables
        fetchSecrets(function () {
            console.log("Callback after fetchSecrets");
            var MONGO_STRING = process.env["MONGO-CONNECTION-STRING"];
            if (MONGO_STRING) {
                console.log("Using mongo string from vault");
            } else {
                console.log("No mongo string from vault; using backup");
                MONGO_STRING = process.env.MONGO_STRING;
            }

            mongo.connect(MONGO_STRING, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            }, function (err, db) {
                if (err) {
                    console.log(err);
                }
                runApp(db);
            });
        });

    } else {
        // In test, use connection string from env variable
        console.log("Running in test env");
        var MONGO_STRING = process.env["MONGO_STRING"];
        mongo.connect(MONGO_STRING, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }, function (err, db) {
            if (err) {
                console.log(err);
                console.log("App can't start without DB");
            } else {
                runApp(db);
            }
        });
    }
}

function runApp(db) {
    let staticCacheSettings = {
        maxAge: '365d',
        cacheControl: true,
        immutable: true,
    }

    function setCacheHeaders(res, path) {
        res.setHeader('x-powered-by', false);
        //res.setHeader('cache-control', 'max-age=31536000, immutable');
        res.setHeader('cache-control', 'no-cache');
    }

    function setNoCacheHeaders(res, path) {
        res.setHeader('x-powered-by', false);
        //res.setHeader('cache-control', 'max-age=31536000, immutable');
        res.setHeader('cache-control', 'no-cache');
    }


    app.use('/public', serveStatic(process.cwd() + '/public', { setHeaders: setNoCacheHeaders }));
    app.use('/controllers', serveStatic(path.join(process.cwd(), 'app/controllers'), { setHeaders: setNoCacheHeaders }));
    app.use('/helpers', serveStatic(path.join(process.cwd(), 'app/helpers'), { setHeaders: setNoCacheHeaders }));

    app.locals.db = db;

    routes(app, db);
    //routes.forEach(function (route) {
    //    route(app, db);
    //});

    app.listen(process.env.PORT || 3000, function () {
        console.log('Listening on port 3000...');
    });

}

startApp();