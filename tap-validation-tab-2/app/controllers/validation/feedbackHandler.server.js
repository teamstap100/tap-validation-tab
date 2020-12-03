'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');
const { safeOid, patToAuth, ADO_API_BASE } = require(process.cwd() + "/app/helpers/helpers.server.js");

function feedbackHandler(dbParent) {
    var db = dbParent.db("clementine");
    var validations = db.collection('validations');

    var feedback = db.collection('feedback');
    var projects = db.collection("adoProjects");

    //const VSTS_API_BASE = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/";
    //const VSTS_WORKITEM_UPDATE_ENDPOINT = VSTS_API_BASE + "workitems/{id}?api-version=4.1";
    //const AUTH = process.env.AUTH;

    const ENV = process.env.ENV;

    /*
    var WINDOWS_AUTH, WINDOWS_ADO_API_BASE;

    if (ENV == "PROD") {
        WINDOWS_AUTH = process.env.WINDOWS_AUTH;
        WINDOWS_ADO_API_BASE = "https://dev.azure.com/microsoft/OS/_apis/wit/";
    } else {
        // Testing with Luciano tenant
        WINDOWS_AUTH = process.env.LUCIANO_AUTH;
        WINDOWS_ADO_API_BASE = "https://dev.azure.com/lucianooo/TestProject/_apis/wit/";
    }
    */

    const ADO_WORKITEM_ADD_ENDPOINT = ADO_API_BASE + "workitems/$Bug?api-version=4.11";
    const ADO_WORKITEM_EDIT_ENDPOINT = ADO_API_BASE + "workitems/{id}?api-version=5.1";
    const ADO_WORKITEM_GET_ENDPOINT = ADO_API_BASE + "workitems/{id}?api-version=4.1";

    function getAuthForCase(validationId, callback) {
        validations.findOne({ _id: safeOid(validationId) }, function (err, valDoc) {
            projects.findOne({ _id: safeOid(valDoc.project) }, function (err, projectDoc) {
                projectDoc.auth = patToAuth(projectDoc.pat);

                return callback(err, projectDoc);
            });
        });
    }

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
                getAuthForCase(req.body.validationId, function (err, project) {
                    if (err) { throw err; }
                    let ado_endpoint = ADO_WORKITEM_GET_ENDPOINT
                        .replace("{org}", project.org)
                        .replace("{project}", project.project)
                        .replace("{id}", feedback._id);

                    const options = {
                        url: ado_endpoint,
                        headers: {
                            'Authorization': project.auth
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

                        if (!(feedback.title)) {
                            feedback.title = "Untitled";
                        }

                        result.push(feedback);
                        feedbackDone++;
                        checkIfDone();
                    });
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
                if (!(doc.title)) {
                    doc.title = "Untitled";
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

        validations.findOne(valQuery, { projection: { tag: 1, areaPath: 1 } }, function (err, valDoc) {
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

            getAuthForCase(req.body.validationId, function (err, project) {
                if (err) { throw err; }

                if (valDoc.areaPath.length > 0) {
                    // Validation-specific area path
                    reqBody.push({
                        "op": "add",
                        "path": "/fields/System.AreaPath",
                        "value": valDoc.areaPath
                    });
                } else if (project.areaPath) {
                    // Project default area path
                    reqBody.push({
                        "op": "add",
                        "path": "/fields/System.AreaPath",
                        "value": project.areaPath
                    });
                } else {
                    // Root of project (shouldn't really happen)
                    reqBody.push({
                        "op": "add",
                        "path": "/fields/System.AreaPath",
                        "value": project.project
                    });
                }

                if (project.project == "OS") {
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

                if (err) { throw err; }
                let ado_endpoint = ADO_WORKITEM_ADD_ENDPOINT
                    .replace("{org}", project.org)
                    .replace("{project}", project.project);

                const options = {
                    url: ado_endpoint,
                    headers: {
                        'Authorization': project.auth,
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

        feedback.findOneAndUpdate(query, op, { returnOriginal: false }, function (err, feedbackDoc) {
            if (err) { throw err; }
            feedbackDoc = feedbackDoc.value;
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
            console.log(feedbackDoc.validationId);
            getAuthForCase(feedbackDoc.validationId, function (err, project) {
                if (err) { throw err; }
                let endpoint = ADO_WORKITEM_EDIT_ENDPOINT
                    .replace("{org}", project.org)
                    .replace("{project}", project.project)
                    .replace("{id}", req.params.id);
                const options = {
                    url: endpoint,
                    headers: {
                        'Authorization': project.auth,
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
        });
    }
};

module.exports = feedbackHandler;