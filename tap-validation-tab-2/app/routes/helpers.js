'use strict';

const path = require('path');
const express = require('express');
const csurf = require('csurf');
const jwt = require('jsonwebtoken');
const request = require('request');

// TODO: These should go in a config
var APP_ID, DOMAIN, AUDIENCE;
if (process.env.ENV == "PROD") {
    APP_ID = "b8d01464-c3fc-4573-a2c3-55ed9113620c";
    DOMAIN = "tap-validation-tab.azurewebsites.net";
} else {
    APP_ID = "7f3150da-ae2e-41d0-8bcd-f04b5dde0299";
    DOMAIN = "taptools.ngrok.io";
}
AUDIENCE = `api://${DOMAIN}/${APP_ID}`;

const TEST_USER = {
    aud: '5b17716e-e0a6-4604-868f-9c781998021f',
    iss: 'https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47/v2.0',
    iat: 1615480461,
    nbf: 1615480461,
    exp: 1615484361,
    acct: 0,
    aio: 'AXQAi/8TAAAAxpQjy4ZTbYYWgPT0PYBGWf9+ZiFdZawVw0fBTvQxbfDhbLFFl8J2QvXEzS13g9I+l28GPsRuhiimuFBRsabeXteCMVQkigu+Q5qzuIw+XzZAoXEvMXrEwr3j004RctFvv3DtCHJt4HbO0vFmYv5E7Q==',
    email: 'tim@dm.de',
    name: 'Max Silbiger (MINDTREE LIMITED)',
    nonce: '2c1fdc960a844857b892f7f8deb1f4e3_20210311164418',
    oid: '512d26c9-aeed-4dbd-a16f-398bcf0ec3fe',
    preferred_username: 'tim@dm.de',
    rh: '0.ARoAv4j5cvGGr0GRqy180BHbR25xF1um4ARGho-ceBmYAh8aANM.',
    sub: 'XIFycJoRnMLyXldtNUF-yf6fZXT5EwWpt_h1BpKgNDg',
    tid: '72f988bf-86f1-41af-91ab-2d7cd011db47',
    uti: 'pKAbpYOqgku-yWcgpwEvAA',
    ver: '2.0'
};


const checkCsrf = csurf({
    cookie: true
});

function includeCsrf(req, res, next) {
    res.locals.csrf = req.csrfToken();
    next();
}

function enforceLogin(req, res, next, loginRedirectUrl) {
    console.log("Called enforceLogin");
    console.log(req.headers);

    console.log("Cookies:");
    console.log(req.cookies);

    let redirect_url = loginRedirectUrl + req.originalUrl

    if (req.header('x-ms-token-aad-id-token')) {
        console.log("AAD ID token exists - let's parse it");

        var token = req.header('x-ms-token-aad-id-token');
        var decoded = jwt.decode(token, { complete: true });

        module.exports.verifyJwt(token, function (err, verified) {
            if (err) {
                console.log(err);
                if (err.message == "jwt expired") {
                    console.log("Jwt expired, so redirecting to login page");
                    return res.redirect(redirect_url);
                } else {
                    console.log("Didn't recognize the error");
                }
            }

            console.log(verified);
            req.user = verified;
            res.locals.user = verified;
            next();
        });

    } else {
        console.log("No x-ms-aad-id-token header - redirecting to login");
        return res.redirect(redirect_url);
    }
}

module.exports = {
    whichEnvironment: function (req, res, next) {
        // Can d use this to render different CSS, etc. based on whether it's on my machine or Prod
        res.locals.env = process.env.ENV;
        next();
    },

    verifyJwt: function (token, callback) {
        // Validating the token requires these steps. See this blog:
        // https://stevelathrop.net/securing-a-node-js-rest-api-with-azure-ad-jwt-bearer-tokens/

        // First, get the right 'kid' value from the decoded token
        var decoded = jwt.decode(token, { complete: true });
        if (decoded == null) {
            return ("No token supplied", null);
        }

        var kid = decoded.header.kid;

        // Determine the correct public key to verify the MSA token
        var keyUrl = "https://login.microsoftonline.com/common/discovery/v2.0/keys";

        request.get(keyUrl, function (err, resp, body) {
            var keys = JSON.parse(body).keys;
            var thisKey = keys.find(key => {
                return key.kid == kid
            });

            var publicKey = '-----BEGIN CERTIFICATE-----\n' + thisKey.x5c[0] + '\n-----END CERTIFICATE-----';

            // for v2.0 tokens
            const verifyOptions = {
                // Audience: this app's ID
                audience: APP_ID,

                // Issuer: MS tenant
                issuer: "https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47/v2.0",
            };

            // for v1.0 tokens - currently being used for the local test, not sure how to switch
            const backupVerifyOptions = {
                audience: AUDIENCE,
                issuer: "https://sts.windows.net/72f988bf-86f1-41af-91ab-2d7cd011db47/",
            }

            jwt.verify(token, publicKey, verifyOptions, function (err, verified) {
                // TOOD: Check "acct" - will be 1 if guest (which is ok here)
                if (err) {
                    console.log("Trying backup verify options");
                    jwt.verify(token, publicKey, backupVerifyOptions, function (err, verified) {
                        return callback(err, verified);
                    })
                } else {
                    console.log(verified);
                    return callback(err, verified);
                }
            });
        });
    },

    enforceLoginTeams: function (req, res, next) {
        console.log("Called enforceLoginTeams");
        if (process.env.ENV == "PROD") {
            return enforceLogin(req, res, next, "/login?redirect=");
        } else {
            console.log("Using TEST_USER");
            req.user = TEST_USER;
            res.locals.user = TEST_USER;
            next();
        }
    },

    enforceIdToken: function (req, res, next) {
        let auth = req.headers["authorization"];
        if (auth) {
            console.log("Got a token");
            let token = auth.replace("Bearer ", "");
            console.log(token);

            var decoded = jwt.decode(token, { complete: true });
            console.log(decoded);

            if (token) {
                module.exports.verifyJwt(token, function (err, verified) {
                    if (err) {
                        console.log(err.message);
                        return res.status(401).send();
                    }

                    console.log("User verified");
                    console.log(verified);
                    req.user = verified;
                    res.locals.user = verified;

                    return next();
                });
            } else {
                if (process.env.ENV == "TEST") {
                    console.log("Using TEST_USER on enforceIdToken");
                    req.user = TEST_USER;
                    res.locals.user = TEST_USER;
                    return next();
                } else {
                    console.log("No auth on this request");
                    return res.status(401).send();
                }
            }
        } else {
            console.log("No auth on this request");
            return res.status(401).send();
        }
    },

    csrfMiddleware: [checkCsrf, includeCsrf],

    test_user: TEST_USER,

};
