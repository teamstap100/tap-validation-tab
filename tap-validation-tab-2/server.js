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
var expressSession = require('express-session');
var methodOverride = require('method-override');
var passport = require('passport');
var bunyan = require('bunyan');

// set up database for express session
var MongoStore = require('connect-mongo')(expressSession);
var mongoose = require('mongoose');

var config = require('./app/config');

var OIDCStrategy = require('passport-azure-ad').OIDCStrategy;
var BearerStrategy = require('passport-azure-ad').BearerStrategy;

// ^ end stuff for Passport

//var jquery = require('jquery');
//var bootstrap = require('bootstrap');

var app = express();

app.set('view engine', 'pug');
app.set('views', './views');

app.use(methodOverride());
app.use(cookieParser());

// set up session middleware
if (config.useMongoDBSessionStore) {
    mongoose.connect(config.databaseUri);
    app.use(express.session({
        secret: 'secret',
        cookie: { maxAge: config.mongoDBSessionMaxAge * 1000 },
        store: new MongoStore({
            mongooseConnection: mongoose.connection,
            clear_interval: config.mongoDBSessionMaxAge
        })
    }));
} else {
    app.use(expressSession({ secret: 'keyboard cat', resave: true, saveUninitialized: false }));
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var log = bunyan.createLogger({
    name: 'Microsoft OIDC Example Web Application'
});

passport.serializeUser(function (user, done) {
    done(null, user.oid);
});

passport.deserializeUser(function (oid, done) {
    findByOid(oid, function (err, user) {
        done(err, user);
    });
});

// array to hold logged in users
var users = [];

var findByOid = function (oid, fn) {
    for (var i = 0, len = users.length; i < len; i++) {
        var user = users[i];
        log.info('we are using user: ', user);
        if (user.oid === oid) {
            return fn(null, user);
        }
    }
    return fn(null, null);
};

passport.use(new OIDCStrategy({
    identityMetadata: config.creds.identityMetadata,
    clientID: config.creds.clientID,
    responseType: config.creds.responseType,
    responseMode: config.creds.responseMode,
    redirectUrl: config.creds.redirectUrl,
    allowHttpForRedirectUrl: config.creds.allowHttpForRedirectUrl,
    clientSecret: config.creds.clientSecret,
    validateIssuer: config.creds.validateIssuer,
    isB2C: config.creds.isB2C,
    issuer: config.creds.issuer,
    passReqToCallback: config.creds.passReqToCallback,
    scope: config.creds.scope,
    loggingLevel: config.creds.loggingLevel,
    nonceLifetime: config.creds.nonceLifetime,
    nonceMaxAmount: config.creds.nonceMaxAmount,
    useCookieInsteadOfSession: config.creds.useCookieInsteadOfSession,
    cookieEncryptionKeys: config.creds.cookieEncryptionKeys,
    clockSkew: config.creds.clockSkew,
},
    function (iss, sub, profile, accessToken, refreshToken, done) {
        console.log(profile);
        if (!profile.oid) {
            return done(new Error("No oid found"), null);
        }
        // asynchronous verification, for effect...
        process.nextTick(function () {
            findByOid(profile.oid, function (err, user) {
                if (err) {
                    return done(err);
                }
                if (!user) {
                    // "Auto-registration"
                    users.push(profile);
                    return done(null, profile);
                }
                return done(null, user);
            });
        });
    }
));

app.use(passport.initialize());
app.use(passport.session());

function ensureAuthenticated(req, res, next) {

    if (req.isAuthenticated()) { return next(); }
    else {
        if (req.session) {
            req.session.returnTo = req.originalUrl;
            console.log("Set req.session.returnTo");
        } else {
            console.log("No session");
        }
        res.redirect('/login');
    }
}


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

    // Auth endpoints
    // '/account' is only available to logged in user
    app.get('/account', ensureAuthenticated, function (req, res) {
        res.render('account', { user: req.user });
    });

    /*
    app.get('/api/protected', passport.authenticate('oauth-bearer', { session: false }), function (req, res) {
        res.status(200).send();
    });
    */

    app.get('/login',
        function (req, res, next) {
            passport.authenticate('azuread-openidconnect',
                {
                    response: res,                      // required
                    resourceURL: config.resourceURL,    // optional. Provide a value if you want to specify the resource.
                    customState: 'my_state',            // optional. Provide a value if you want to provide custom state value.
                    failureRedirect: '/'
                }
            )(req, res, next);
        },
        function (req, res) {
            log.info('Login was called in the Sample');
            //console.log("Login was called");
            //res.redirect('/');
            console.log(req.session.returnTo);
            var redirectionUrl = req.session.returnTo || '/';
            res.redirect(redirectionUrl);
        });

    // redirected to '/' (home page); otherwise, it passes to the next middleware.
    app.get('/auth/openid/return',
        function (req, res, next) {
            passport.authenticate('azuread-openidconnect',
                {
                    response: res,                      // required
                    failureRedirect: '/'
                }
            )(req, res, next);
        },
        function (req, res) {
            //console.log("Received a return);")
            log.info('We received a return from AzureAD.');
            //res.redirect('/');
            console.log(req.session.returnTo);
            var redirectionUrl = req.session.returnTo || '/';
            res.redirect(redirectionUrl);
        });

    // 'POST returnURL'
    // `passport.authenticate` will try to authenticate the content returned in
    // body (such as authorization code). If authentication fails, user will be
    // redirected to '/' (home page); otherwise, it passes to the next middleware.
    app.post('/auth/openid/return',
        function (req, res, next) {
            passport.authenticate('azuread-openidconnect',
                {
                    response: res,                      // required
                    failureRedirect: '/'
                }
            )(req, res, next);
        },
        function (req, res) {
            //console.log("Received a return");
            log.info('We received a return from AzureAD.');
            //res.redirect('/');
            console.log(req.session.returnTo);
            var redirectionUrl = req.session.returnTo || '/';
            res.redirect(redirectionUrl);
        });

    // 'logout' route, logout from passport, and destroy the session with AAD.
    app.get('/logout', function (req, res) {
        req.session.destroy(function (err) {
            req.logOut();
            res.redirect(config.destroySessionUrl);
        });
    });

    routes(app, db);

    app.listen(process.env.PORT || 3000, function () {
        console.log('Listening on port 3000...');
    });

});