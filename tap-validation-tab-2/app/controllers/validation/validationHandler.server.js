'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');

function validationHandler(dbParent) {

    //var clicks = db.collection('clicks');
    // "db.collection is not a function"
    var db = dbParent.db("clementine");
    var validations = db.collection('validations');

    //var bugs = db.collection('bugs');
    var cases = db.collection('cases');
    var feedback = db.collection('feedback');
    var featureRequests = db.collection('featureRequests');
    var windowsBuilds = db.collection('windowsBuilds');

    var pms = db.collection('pms');

    this.getIndex = function (req, res) {
        res.render('index', {});
    };

    this.getValidations = function (req, res) {
        // Projection excludes/includes various fields.

        var alphaSort = { name: 1 };

        var activeNonBugValidations = {
            active: true,
            caseOrder: "normal"
        };

        var validationProjection = {
            name: 1,
            owner: 1,
            tap: 1,
            groups: 1,
        };

        validations.find(activeNonBugValidations).project(validationProjection).sort(alphaSort).toArray(function (err, results) {
            //console.log(results);
            if (err) {
                throw err;
            }

            pms.find({ active: true }).toArray(function (err, pmDocs) {
                res.render('validation/config', {
                    validations: results,
                    pms: pmDocs
                });
            })
        });
    };

    this.getValidation = function (req, res) {
        //console.log(req.params.vId);
        var safevId = req.params.vId;
        if (req.params.vId.includes("&")) {
            safevId = safevId.split("&")[0];
        }
        var query;
        try {
            query = ObjectID(safevId);
        } catch (error) {
            query = { _id: parseInt(safevId) };
        }

        let validationProjection = {
            name: 1,
            tap: 1,
            groups: 1,
            blurb: 1,
            tag: 1,
            active: 1,
            customCaseOrder: 1,
            settings: 1,
        }

        //console.log(query);
        validations.findOne(query, { projection: validationProjection }, function (err, validationDoc) {
            if (err) {
                throw err;
            }

            // One query for cases, feedback, and featureRequests
            var linkedItemsQuery;

            try {
                linkedItemsQuery = { validationId: ObjectID(safevId) };
            } catch (error) {
                linkedItemsQuery = { validationId: parseInt(safevId) };
            }

            //console.log(bugs.find(bugQuery).toArray());
            var caseOrder = validationDoc.caseOrder;
            var timeSort = { "_id": 1 };
            var reverseTimeSort = { "_id": -1 };

            if (caseOrder == "normal") {
                var caseSort = timeSort;
            } else {
                var caseSort = reverseTimeSort;
            }

            if (validationDoc.blurb) {
                validationDoc.blurb = validationDoc.blurb.replace(/background-color: rgb\(255, 255, 255\);/g, "");
            }

            let caseQuery = linkedItemsQuery;
            //caseQuery.active = true;

            let caseProjection = {
                _id: 1,
                name: 1,
                group: 1,
                description: 1,
                active: 1,
            };

            //console.log("caseOrder is " + validationDoc.caseOrder);
            cases.find(caseQuery).project(caseProjection).sort(caseSort).toArray(function (err, caseDocs) {
                if (err) { throw err; }

                let safeCases = [];
                caseDocs.forEach(function (kase) {
                    if (kase.description) {
                        kase.description = kase.description.replace(/background-color: rgb\(255, 255, 255\);/g, "");
                    }
                    safeCases.push(kase);
                });

                let feedbackQuery = linkedItemsQuery;
                feedbackQuery.public = true;

                feedback.find(feedbackQuery).toArray(function (err, feedbackDocs) {

                    // We can still use feedbackQuery to get feature requests, as we also need the public ones there
                    featureRequests.find(feedbackQuery).toArray(function (err, featureRequestDocs) {

                        let versions = [];

                        if (validationDoc.tap == "Windows") {
                            windowsBuilds.findOne({}, function (err, buildDoc) {
                                versions = buildDoc.builds;
                                // Sort in descending numerical order

                                versions = versions.sort(function (a, b) { return b - a });

                                res.render('validation/validation', {
                                    validation: validationDoc,
                                    cases: safeCases,
                                    feedback: feedbackDocs,
                                    featureRequests: featureRequestDocs,
                                    windowsBuilds: versions
                                });
                            });
                        } else {
                            res.render('validation/validation', {
                                validation: validationDoc,
                                cases: safeCases,
                                feedback: feedbackDocs,
                                featureRequests: featureRequestDocs,
                                windowsBuilds: versions
                            });
                        }
                    });
                });
            });
        });
    };

    this.updateValidation = function (req, res) {
        //console.log(req.body.validationId, req.body.tabUrl);

        validations.updateOne({ _id: parseInt(req.body.validationId) }, { $set: { tabUrl: req.body.tabUrl } }, function (err, doc) {
            if (err) { throw err; }

            res.status(200);
            res.send();
        });
    }

    this.assignPublicIds = function (req, res) {
        cases.updateOne({ tap: "Windows", "upvotes_v2": { $ne: [] }, "upvotes_v2.publicId": { $exists: false } }, { $set: { "upvotes_v2.$.publicId": new ObjectID() } }, function (err, caseDoc) {
            if (err) { throw err; }
            console.log("Done");
        });
    }
};

module.exports = validationHandler;