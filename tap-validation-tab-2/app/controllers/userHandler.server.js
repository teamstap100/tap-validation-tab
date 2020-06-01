'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');

function userHandler(dbParent) {

    //var clicks = db.collection('clicks');
    // "db.collection is not a function"
    var db = dbParent.db("clementine");
    var users = db.collection('users');

    const PREF_NAMES = [
        "windowsBuildVersion",
        "windowsBuildType",
        "makeFeedbackPublic"
    ];

    this.getUserPrefs = function (req, res) {
        let oid = req.params.oid;
        users.findOne({ _id: oid }, function (err, userDoc) {
            if (userDoc) {
                res.json(userDoc.prefs);
            } else {
                res.json({});
            }
        });
    };

    this.setUserPrefs = function (req, res) {
        let oid = req.body.oid;
        let email = req.body.email;
        let prefs = req.body.prefs;

        console.log(req.body);

        users.findOne({ _id: oid }, function (err, userDoc) {
            if (userDoc) {

                // Keep old pref values, but update any that are in the body
                let combinedPrefs = userDoc.prefs;
                PREF_NAMES.forEach(function (pref) {
                    if (prefs[pref]) {
                        combinedPrefs[pref] = prefs[pref];
                    }
                })

                users.updateOne({ _id: oid }, { $set: { prefs: combinedPrefs } }, function (err, userDoc) {
                    return res.status(200).send();
                });
            } else {
                let newUser = {
                    _id: oid,
                    email: email,
                    tid: "",
                    tenantName: "",
                    prefs: prefs,
                }
                users.insertOne(newUser, function (err, userDoc) {
                    return res.status(200).send();
                });
            }
        });
    }
    
};

module.exports = userHandler;