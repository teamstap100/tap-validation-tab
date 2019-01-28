'use strict';

var ObjectID = require('mongodb').ObjectID;

function validationHandler(dbParent) {

    //var clicks = db.collection('clicks');
    // "db.collection is not a function"
    var db = dbParent.db("clementine");
    var validations = db.collection('validations');

    var bugs = db.collection('bugs');
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

        validations.find({}).sort(alphaSort).toArray(function (err, results) {
            if (err) {
                throw err;
            }

            if (results) {
                console.log(results);
                res.render('config', {
                    "validations": results
                });
            } else {
                res.send("Validation with that id not found.");
            }
        });
    };

    this.getValidation = function (req, res) {
        console.log(req.params.vId);
        var query = ObjectID(req.params.vId);
        //console.log(query);
        validations.findOne(query, {}, function (err, validationDoc) {
            if (err) {
                throw err;
            }
            console.log(validationDoc);

            var bugQuery = { "validationId": ObjectID(req.params.vId) };
            var caseQuery = { "validationId": ObjectID(req.params.vId) };

            console.log(bugs.find(bugQuery).toArray());

            var caseOrder = validationDoc.caseOrder;
            var timeSort = { "_id": 1 };
            var reverseTimeSort = { "_id": -1 };

            if (caseOrder == "normal") {
                var caseSort = timeSort;
            } else {
                var caseSort = reverseTimeSort;
            }

            console.log("caseOrder is " + validationDoc.caseOrder);

            bugs.find(bugQuery).sort(caseSort).toArray(function (err, bugDoc) {
                if (err) { throw err; }
                console.log(bugDoc);
                cases.find(caseQuery).sort(caseSort).toArray(function (err, caseDoc) {
                    if (err) { throw err; }

                    console.log(caseDoc);

                    res.render('validation', {
                        "validation": validationDoc,
                        "bugs": bugDoc,
                        "cases": caseDoc
                    });
                });
            });
        });
    };
};

module.exports = validationHandler;