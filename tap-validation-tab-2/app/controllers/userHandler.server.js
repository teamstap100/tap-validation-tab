'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');

function userHandler(dbParent) {

    //var clicks = db.collection('clicks');
    // "db.collection is not a function"
    var db = dbParent.db("clementine");
    var users = db.collection('users');
    var pms = db.collection('pms');
    var validations = db.collection('validations');

    const PREF_NAMES = [
        // Windows prefs
        "windowsBuildVersion",
        "windowsBuildType",
        "votesPublic",
        "feedbackPublic",
        "featureRequestsPublic",

        // Teams validation prefs
        "device",
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
                    console.log(pref, prefs[pref]);
                    if (pref in prefs) {
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

    // (duplicated from admin app)
    this.getPmTaps = function (req, res) {
        // Get the TAPs that a given PM belongs to.
        let pmEmail = req.params.email;

        let validationProjection = {
            name: 1,
            groups: 1,
            owner: 1,
            tap: 1
        }

        let taps = [];
        pms.findOne({ email: pmEmail }, function (err, pmDoc) {
            if (err) { console.log(err); }
            if (pmDoc == null) {
                // Backup: Try looking for any validation that has this alias as owner
                validations.find({owner: pmEmail}).project(validationProjection).toArray(function (err, valDocs) {
                    if (err) {
                        console.log(err);

                        return res.json({
                            taps: taps
                        });
                    }

                    if (valDocs) {
                        valDocs.forEach(function (valDoc) {
                            if (!(taps.includes(valDoc.tap))) {
                                taps.push(valDoc.tap);
                            }
                        });
                    } else {
                        taps = [];
                    }
                    return res.json({
                        taps: taps,
                        validations: valDocs
                    });
                });
            } else {
                if (Array.isArray(pmDoc.tap)) {
                    taps = pmDoc.tap;
                } else {
                    taps = [pmDoc.tap];
                }
                validations.find({ owner: pmEmail }).project(validationProjection).toArray(function (err, valDocs) {
                    if (err) { console.log(err); }
                    return res.json({
                        taps: taps,
                        validations: valDocs
                    });
                });
            }


        })
    }

    /*
    this.getPmValidations = function (req, res) {
        pms.findOne({ email: pmEmail }, function (err, pmDoc) {
            if (pmDoc == null) {
                return res.json({
                    taps: []
                });
            }

            let taps = [];
            if (Array.isArray(pmDoc.tap)) {
                taps = pmDoc.tap;
            } else {
                taps = [pmDoc.tap];
            }
        });

    }
    */
    
};

module.exports = userHandler;