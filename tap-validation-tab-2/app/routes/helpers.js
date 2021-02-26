'use strict';

const path = require('path');
const express = require('express');
const csurf = require('csurf');
const jwt = require('jsonwebtoken');
const request = require('request');

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

            const verifyOptions = {
                // Audience: this app's ID
                audience: "b8d01464-c3fc-4573-a2c3-55ed9113620c",

                // Issuer: MS tenant
                issuer: "https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47/v2.0",
            };

            jwt.verify(token, publicKey, verifyOptions, function (err, verified) {
                // TOOD: Check "acct" - will be 1 if guest (which is ok here)
                return callback(err, verified);
            });
        });
    },

    enforceLoginTeams: function (req, res, next) {
        if (process.env.ENV == "PROD") {
            return enforceLogin(req, res, next, "/login?redirect=");
        } else {
            next();
        }
    },

    enforceIdToken: function (req, res, next) {
        let auth = req.headers["authorization"];
        if (auth) {
            let token = auth.replace("Bearer ", "");
            //console.log(token);

            var decoded = jwt.decode(token, { complete: true });
            //console.log(decoded);

            module.exports.verifyJwt(token, function (err, verified) {
                if (err) {
                    console.log(err.message);
                    return res.status(401).send();
                }

                console.log("User verified");
                console.log(verified);
                req.user = verified;
                return next();
            });
        } else {
            console.log("Warning - no auth on this request");
            return next();
        }
    },

    csrfMiddleware: [checkCsrf, includeCsrf],

};
