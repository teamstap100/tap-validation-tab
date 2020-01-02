'use strict';

var ObjectID = require('mongodb').ObjectID;
var teamsDeepLink = require('microsoft-teams-deep-link');

function validationHandler(dbParent) {

    //var clicks = db.collection('clicks');
    // "db.collection is not a function"
    var db = dbParent.db("clementine");
    var validations = db.collection('validations');

    //var bugs = db.collection('bugs');
    var cases = db.collection('cases');

    // db used to return the db, now it returns the parent in mongo 3.0.0.
    // So, need to point it to the real db each time.

    this.getIndex = function (req, res) {
        var params = {}
        console.log(req.query);
        if (req.query.success == 'true') {
            params.success = 'true'
        }

        res.render('index', params);
    };

    this.getValidations = function (req, res) {
        // Projection excludes/includes various fields.

        var alphaSort = { name: 1 };

        var activeNonBugValidations = {
            active: true,
            caseOrder: "normal"
        };

        validations.find(activeNonBugValidations).sort(alphaSort).toArray(function (err, results) {
            if (err) {
                throw err;
            }

            var scenarioValidations = [];

            results.forEach(function (result) {
                if (result.active) {
                    //scenarioValidations.push(result);
                    if (result.test != true) {
                        scenarioValidations.push(result);
                    }
                }
            });
            res.render('config', {
                "validations": scenarioValidations
            });
        });
    };

    this.getValidation = function (req, res) {
        console.log(req.params.vId);
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
        //console.log(query);
        validations.findOne(query, {}, function (err, validationDoc) {
            if (err) {
                throw err;
            }
            console.log(validationDoc);

            var bugQuery, caseQuery;

            try {
                bugQuery = { "validationId": ObjectID(safevId) };
                caseQuery = { "validationId": ObjectID(safevId) };
            } catch (error) {
                bugQuery = { validationId: parseInt(safevId) };
                caseQuery = { validationId: parseInt(safevId) };
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

            console.log("caseOrder is " + validationDoc.caseOrder);
            cases.find(caseQuery).sort(caseSort).toArray(function (err, caseDoc) {
                if (err) { throw err; }

                console.log(caseDoc);

                res.render('validation', {
                    "validation": validationDoc,
                    "cases": caseDoc
                });
            });
        });
    };

    this.updateValidation = function (req, res) {
        console.log(req.body.validationId, req.body.tabUrl);

        validations.updateOne({ _id: parseInt(req.body.validationId) }, { $set: { tabUrl: req.body.tabUrl } }, function (err, doc) {
            if (err) { throw err; }

            res.status(200);
            res.send();
        });
    }
};

module.exports = validationHandler;