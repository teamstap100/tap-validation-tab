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

    var pms = db.collection('pms');

    const VSTS_API_BASE = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/";
    const VSTS_WORKITEM_UPDATE_ENDPOINT = VSTS_API_BASE + "workitems/{id}?api-version=4.1";
    const AUTH = process.env.AUTH;

    // Testing with Luciano tenant
    const WINDOWS_AUTH = process.env.LUCIANO_AUTH;
    const WINDOWS_ADO_API_BASE = "https://dev.azure.com/lucianooo/TestProject/_apis/wit/";
    const WINDOWS_ADO_WORKITEM_ADD_ENDPOINT = WINDOWS_ADO_API_BASE + "workitems/$Task?api-version=4.11";
    //const WINDOWS_ADO_ATTACHMENT_CREATE_ENDPOINT = WINDOWS_ADO_API_BASE + "attachments";
    //const WINDOWS_ADO_WORKITEM_UPDATE_ENDPOINT = WINDOWS_ADO_API_BASE + "workitems/{id}?api-version=4.1";

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
            console.log(results);
            if (err) {
                throw err;
            }

            pms.find({ active: true }).toArray(function (err, pmDocs) {
                res.render('config', {
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
            caseOrder: 1
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

            let caseProjection = {
                _id: 1,
                name: 1,
                group: 1,
                description: 1,
            };

            //console.log("caseOrder is " + validationDoc.caseOrder);
            cases.find(linkedItemsQuery).project(caseProjection).sort(caseSort).toArray(function (err, caseDocs) {
                if (err) { throw err; }

                let safeCases = [];
                caseDocs.forEach(function (kase) {
                    kase.description = kase.description.replace(/background-color: rgb\(255, 255, 255\);/g, "");
                    safeCases.push(kase);
                });

                let feedbackQuery = linkedItemsQuery;
                feedbackQuery.public = true;

                feedback.find(feedbackQuery).toArray(function (err, feedbackDocs) {
                    console.log(feedbackDocs);

                    featureRequests.find(linkedItemsQuery).toArray(function (err, featureRequestDocs) {
                        res.render('validation', {
                            validation: validationDoc,
                            cases: safeCases,
                            feedback: feedbackDocs,
                            featureRequests: featureRequestDocs,
                        });
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

    this.getFeedbackByUser = function (req, res) {
        console.log(req.body);
        let validationId = parseInt(req.body.validationId);
        let userEmail = req.body.userEmail;

        // Get all feedback submitted by this user, or others' public feedback
        let feedbackQuery = {
            validationId: validationId,
            $or: [
                { submitterEmail: userEmail },
                { public: true }
            ],
        };

        feedback.find(feedbackQuery).toArray(function (err, feedbackDocs) {
            feedbackDocs.forEach(function (doc) {
                if (!(doc.submitterEmail == userEmail)) {
                    doc.submitterEmail = "someone else";
                    doc.showEditButton = false;
                } else {
                    doc.showEditButton = true;
                }
            });
            return res.json({ feedback: feedbackDocs });
        });
    }

    this.addFeedback = function (req, res) {
        console.log(req.body);

        // Temp
        //req.body.submitterEmail = "someone@gmail.com";

        let validationId = parseInt(req.body.validationId);

        let feedbackObj = {
            text: req.body.text,
            submitterEmail: req.body.submitterEmail,
            validationId: validationId,
            timestamp: new Date(),
            public: req.body.public,
        };

        //validations.updateOne({ _id: parseInt(req.body.validationId) }, { $push: { feedback: feedback } }, function (err, doc) {
        let bugTitle = "Feedback - " + req.body.text;
        // TODO: Add the validation's tag

        validations.findOne({ _id: validationId }, {
            projection: { tag: 1 }
        }, function (err, valDoc) {
            let tags = "WCTAP; WCTAP-Feedback; " + valDoc.tag;

            //let systemInfo = "<strong>Build Type</strong>: " + body.windowsBuildType + "<br />";
            //systemInfo += "<strong>Build Version</strong>: " + body.windowsBuildVersion + "<br />";

            let description = '"' + req.body.text + '"<br /><strong>Submitter</strong>: ' + req.body.submitterEmail;

            var reqBody = [
                {
                    "op": "add",
                    "path": "/fields/System.Title",
                    "value": bugTitle
                },
                {
                    "op": "add",
                    "path": "/fields/System.Tags",
                    "value": tags,
                },
                {
                    "op": "add",
                    "path": "/fields/System.Description",
                    "value": description,
                }
            ];
            const options = {
                url: WINDOWS_ADO_WORKITEM_ADD_ENDPOINT,
                headers: {
                    'Authorization': WINDOWS_AUTH,
                    'Content-Type': 'application/json-patch+json'
                },
                body: JSON.stringify(reqBody)
            };

            console.log(options);

            request.post(options, function (vstsErr, vstsStatus, vstsResponse) {
                if (vstsErr) { console.log(vstsErr); }
                vstsResponse = JSON.parse(vstsResponse);
                feedbackObj._id = vstsResponse.id;

                feedback.insertOne(feedbackObj, function (err, feedbackDoc) {
                    res.status(200).send();
                });
            });
        });
    }

    this.modifyFeedback = function (req, res) {

        console.log(req.params);
        console.log(req.body);

        feedback.updateOne({ _id: req.params.id }, {
            $set: { text: req.body.text }
        }, function (err, feedbackDoc) {
            console.log(feedbackDoc);

            // TODO: Write changes to ADO

            return res.status(200).send();
        });
    }
};

module.exports = validationHandler;