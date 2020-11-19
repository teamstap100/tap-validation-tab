'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');
const { safeOid } = require(process.cwd() + "/app/helpers/helpers.server.js");

function feedbackHandler(dbParent) {
    var db = dbParent.db("clementine");
    var validations = db.collection('validations');

    var feedback = db.collection('feedback');

    //const VSTS_API_BASE = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/";
    //const VSTS_WORKITEM_UPDATE_ENDPOINT = VSTS_API_BASE + "workitems/{id}?api-version=4.1";
    //const AUTH = process.env.AUTH;

    const ENV = process.env.ENV;

    var WINDOWS_AUTH, WINDOWS_ADO_API_BASE;

    if (ENV == "PROD") {
        WINDOWS_AUTH = process.env.WINDOWS_AUTH;
        WINDOWS_ADO_API_BASE = "https://dev.azure.com/microsoft/OS/_apis/wit/";
    } else {
        // Testing with Luciano tenant
        WINDOWS_AUTH = process.env.LUCIANO_AUTH;
        WINDOWS_ADO_API_BASE = "https://dev.azure.com/lucianooo/TestProject/_apis/wit/";
    }

    const WINDOWS_ADO_WORKITEM_ADD_ENDPOINT = WINDOWS_ADO_API_BASE + "workitems/$Bug?api-version=4.11";
    const WINDOWS_ADO_WORKITEM_EDIT_ENDPOINT = WINDOWS_ADO_API_BASE + "workitems/{ID}?api-version=5.1";
    const WINDOWS_ADO_WORKITEM_GET_ENDPOINT = WINDOWS_ADO_API_BASE + "workitems/{id}?api-version=4.1";


    const WINDOWS_BUG_ASSIGNEE = "ericmain@microsoft.com";

    function cleanEmail(email) {
        email = email.toLowerCase();
        email = email.replace("#ext#@microsoft.onmicrosoft.com", "");
        if (email.includes("@")) {
            return email;

        } else if (email.includes("_")) {
            console.log("Going the underscore route");
            var underscoreParts = email.split("_");
            var domain = underscoreParts.pop();
            var tenantString = domain.split(".")[0];

            if (underscoreParts.length > 1) {
                email = underscoreParts.join("_") + "@" + domain;
            } else {
                email = underscoreParts[0] + "@" + domain;
            }
        }
        return email;
    }

    this.getFeedbackByUser = function (req, res) {
        //let validationId = parseInt(req.body.validationId);
        let validationId = req.body.validationId;
        let userEmail = req.body.userEmail;

        // Get all feedback submitted by this user, or others' public feedback
        let feedbackQuery = {
            validationId: safeOid(validationId),
            submitterEmail: userEmail,
        }

        console.log("Here's the feedback query");

        console.log(feedbackQuery);

        var result = [];
        var feedbackDone = 0;
        var feedbackCount = 0;

        function checkIfDone() {
            if (feedbackDone == feedbackCount) {
                return res.json({ feedback: result});
            }
        }

        feedback.find(feedbackQuery).toArray(function (err, feedbackDocs) {
            feedbackCount = feedbackDocs.length;
            feedbackDocs.forEach(function (feedback) {
                let ado_endpoint = WINDOWS_ADO_WORKITEM_GET_ENDPOINT.replace("{id}", feedback._id);
                console.log(ado_endpoint);

                const options = {
                    url: ado_endpoint,
                    headers: {
                        'Authorization': WINDOWS_AUTH,
                    }
                };
                request.get(options, function (err, resp, body) {
                    try {
                        body = JSON.parse(body);
                        console.log(body.fields["System.State"]);
                        console.log(body.fields["System.Reason"]);

                        feedback.state = body.fields["System.State"];
                        feedback.reason = body.fields["System.Reason"];
                    } catch (e) {
                        console.log(e);
                        console.log("Falling back on default");
                        feedback.state = "New";
                        feedback.reason = "New";
                    }
                    result.push(feedback);
                    feedbackDone++;
                    checkIfDone();
                });
            });

        });
    }

    this.getPublicFeedback = function (req, res) {
        // Get the public feedback not by this user.
        console.log(req.body);
        let validationId = req.body.validationId;
        //let validationId = parseInt(req.body.validationId);
        let userEmail = req.body.userEmail;

        // Get all feedback submitted by this user, or others' public feedback
        let feedbackQuery = {
            validationId: safeOid(validationId),
            submitterEmail: { $ne: userEmail },
            public: true,
        }

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

        let validationId = safeOid(req.body.validationId);

        let valQuery = {
            _id: validationId
        };

        let feedbackObj = {
            title: req.body.title,
            text: req.body.text,
            submitterEmail: req.body.submitterEmail,
            validationId: validationId,
            timestamp: new Date(),
            public: req.body.public,
        };

        let bugTitle = "Feedback - " + req.body.text;

        /*
        if (isNaN(req.body.validationId)) {
            valQuery._id = ObjectID(req.body.validationId);
        } else {
            valQuery._id = parseInt(req.body.validationId);
        }
        */

        console.log(valQuery);

        validations.findOne(valQuery, { projection: { tag: 1 } }, function (err, valDoc) {
            if (err) { console.log(err); }


            let tags = "WCCP; WCCP-GeneralFeedback; " + valDoc.tag;

            //let systemInfo = "<strong>Build Type</strong>: " + body.windowsBuildType + "<br />";
            //systemInfo += "<strong>Build Version</strong>: " + body.windowsBuildVersion + "<br />";

            let safeTitle = req.body.title;
            if (safeTitle.length > 120) {
                safeTitle = safeTitle.substring(0, 117) + "...";
            }

            let userEmail = cleanEmail(req.body.submitterEmail);

            let description = '"' + req.body.text + '"<br /><strong>Submitter</strong>: ' + userEmail + " (" + req.body.submitterEmail + ")";

            var reqBody = [
                {
                    "op": "add",
                    "path": "/fields/System.Title",
                    "value": safeTitle
                },
                {
                    "op": "add",
                    "path": "/fields/System.Tags",
                    "value": tags,
                },
                {
                    "op": "add",
                    "path": "/fields/Microsoft.VSTS.TCM.ReproSteps",
                    "value": description,
                },

            ];

            if (ENV == "PROD") {
                // This area path only works in production
                reqBody.push({
                    "op": "add",
                    "path": "/fields/System.AreaPath",
                    "value": "OS\\Core\\EMX\\CXE\\Customer Connection\\TAP"
                });

                if (userEmail) {
                    reqBody.push({
                        "op": "add",
                        "path": "/fields/OSG.Partner.PartnerPOC",
                        "value": userEmail
                    });
                }


                reqBody.push({
                    "op": "add",
                    "path": "/fields/Microsoft.VSTS.Common.Release",
                    "value": "Cobalt"
                });
            }

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
                    if (err) { console.log(err); }
                    console.log(feedbackDoc);
                    return res.status(200).send();
                });
            });
        });
    }

    this.modifyFeedback = function (req, res) {
        console.log(req.params);
        console.log(req.body);
        console.log(req.body.public)

        let op = {};
        if ('text' in req.body) {
            op = { $set: { text: req.body.text } };
        } else if ('public' in req.body) {
            op = { $set: { public: req.body.public } };
        }

        console.log(op);

        let query = { _id: safeOid(req.params.id) };

        feedback.updateOne(query, op, function (err, feedbackDoc) {
            console.log(feedbackDoc);
            // Write changes to ADO
            let safeTitle = "Feedback - " + req.body.text;
            if (safeTitle.length > 120) {
                safeTitle = safeTitle.substring(0, 117) + "...";
            }
            let description = '"' + req.body.text + '"<br /><strong>Submitter</strong>: ' + feedbackDoc.submitterEmail;

            var reqBody = [
                {
                    "op": "add",
                    "path": "/fields/System.Title",
                    "value": safeTitle
                },
                {
                    "op": "add",
                    "path": "/fields/Microsoft.VSTS.TCM.ReproSteps",
                    "value": description,
                }
            ];
            let endpoint = WINDOWS_ADO_WORKITEM_EDIT_ENDPOINT.replace("{ID}", req.params.id);
            const options = {
                url: endpoint,
                headers: {
                    'Authorization': WINDOWS_AUTH,
                    'Content-Type': 'application/json-patch+json'
                },
                body: JSON.stringify(reqBody)
            };

            console.log(options);

            request.patch(options, function (vstsErr, resp, body) {
                if (vstsErr) { console.log(vstsErr); }
                console.log(resp.statusCode);

                res.status(200).send();

            });

            return res.status(200).send();
        });
    }
};

module.exports = feedbackHandler;