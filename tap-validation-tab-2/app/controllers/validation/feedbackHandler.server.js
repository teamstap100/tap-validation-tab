'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');
const { safeOid, patToAuth, ADO_API_BASE, uploadAttachments, cleanEmail, isMicrosoft } = require(process.cwd() + "/app/helpers/helpers.server.js");

function feedbackHandler(dbParent) {
    var db = dbParent.db("clementine");
    var validations = db.collection('validations');

    var feedback = db.collection('feedback');
    var projects = db.collection("adoProjects");

    //const VSTS_API_BASE = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/";
    //const VSTS_WORKITEM_UPDATE_ENDPOINT = VSTS_API_BASE + "workitems/{id}?api-version=4.1";

    const ENV = process.env.ENV;

    const ADO_WORKITEM_ADD_ENDPOINT = ADO_API_BASE + "workitems/$Bug?api-version=4.11";
    const ADO_WORKITEM_EDIT_ENDPOINT = ADO_API_BASE + "workitems/{id}?api-version=5.1";
    const ADO_WORKITEM_GET_ENDPOINT = ADO_API_BASE + "workitems/{id}?api-version=4.1";

    function getWindowsReproSteps(body) {
        let tableStyle = "border: solid black 1px; padding: 4px 4px 4px 4px;";

        // Take a bug and create Windows repro steps for it.
        let reproSteps = `<br /><table style='${tableStyle}'><tbody>`;

        // Original description
        reproSteps += `<tr style='${tableStyle}'> <td style='${tableStyle}'> Details </td> <td style='${tableStyle}'>${body.text} </td></tr>`;

        // Submitter
        let userEmail;
        if (body.email) {
            userEmail = body.email;
        } else if (body.userEmail) {
            userEmail = body.userEmail;
        } else if (body.submitterEmail) {
            userEmail = body.submitterEmail;
        }

        //userEmail = cleanEmail(userEmail);

        // reproSteps += `<tr style='${tableStyle}'> <td style='${tableStyle}'> Submitter </td> <td id='userEmail' style='${tableStyle}'>${userEmail} </td></tr>`;

        // Public ID
        if (body.publicId) {
            reproSteps += `<tr style='${tableStyle}'> <td style='${tableStyle}'> Public ID </td> <td style='${tableStyle}'>${body.publicId} </td></tr>`;
        }

        // Windows build info
        if (body.windowsBuildType) {
            reproSteps += `<tr style='${tableStyle}'> <td style='${tableStyle}'> Build Type </td> <td style='${tableStyle}'>${body.windowsBuildType} </td></tr>`;
        }

        if (body.windowsBuildVersion) {
            reproSteps += `<tr style='${tableStyle}'> <td style='${tableStyle}'> Build Version </td> <td style='${tableStyle}'>${body.windowsBuildVersion} </td></tr>`;
        }

        // Upvotes
        let upvotesCount = 0;
        if (body.upvotes) {
            upvotesCount = body.upvotes.length;
        }

        reproSteps += `<tr style='${tableStyle}'> <td style='${tableStyle}'> Upvotes </td> <td style='${tableStyle}'>${upvotesCount} </td></tr>`;

        // Comments
        let commentsTable = `<table style='${tableStyle} width: 100%'><tbody>`;
        if (body.comments) {
            body.comments.forEach(function (comment) {
                commentsTable += `<tr style='${tableStyle}'> <td style='${tableStyle}'> "${comment.comment}" - ${comment.email}</td></tr>`
            });
        }
        commentsTable += "</tbody></table>";

        reproSteps += `<tr style='${tableStyle}'> <td style='${tableStyle}'> Comments </td> <td style='${tableStyle}'>${commentsTable} </td></tr>`;

        reproSteps += "</tbody></table>";
        reproSteps += "</br>";

        return reproSteps;
    }

    function getAuthForCase(validationId, callback) {
        validations.findOne({ _id: safeOid(validationId) }, function (err, valDoc) {
            projects.findOne({ _id: safeOid(valDoc.project) }, function (err, projectDoc) {
                projectDoc.auth = patToAuth(projectDoc.pat);

                return callback(err, projectDoc);
            });
        });
    }

    function getStateAndReason(validationId, feedback, callback) {
        // Set the ADO fields for a given piece of feedback
        getAuthForCase(validationId, function (err, project) {
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
                    //console.log(body);
                    body = JSON.parse(body);

                    feedback.state = body.fields["System.State"];
                    feedback.reason = body.fields["Microsoft.VSTS.Common.ResolvedReason"] || body.fields["System.Reason"];
                } catch (e) {
                    console.log("Falling back on default");
                    feedback.state = "New";
                    feedback.reason = "New";
                }

                if (!(feedback.title)) {
                    feedback.title = "Untitled";
                }

                callback(feedback);
            });
        });
    }

    this.getFeedbackByUser = function (req, res) {
        let validationId = req.query.validationId;
        let userEmail = req.query.userEmail;

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

            if (feedbackCount == 0) {
                return res.json({ feedback: [] });
            }

            feedbackDocs.forEach(function (feedback) {
                getStateAndReason(validationId, feedback, function (updatedFeedback) {
                    result.push(updatedFeedback);
                    feedbackDone++;
                    checkIfDone();
                })
            });
        });
    }

    this.getPublicFeedback = function (req, res) {
        // Get the public feedback not by this user.
        //console.log(req.body);
        let validationId = req.query.validationId;
        //let validationId = parseInt(req.body.validationId);
        let userEmail = req.query.userEmail;

        // Get all feedback submitted by this user, or others' public feedback
        let feedbackQuery = {
            validationId: safeOid(validationId),
            submitterEmail: { $ne: userEmail },
            public: true,
        }

        var result = [];
        var feedbackDone = 0;
        var feedbackCount = 0;

        function checkIfDone() {
            if (feedbackDone == feedbackCount) {
                return res.json({ feedback: result });
            }
        }

        feedback.find(feedbackQuery).toArray(function (err, feedbackDocs) {
            feedbackCount = feedbackDocs.length;

            if (feedbackCount == 0) {
                return res.json({ feedback: [] });
            }

            feedbackDocs.forEach(function (fb) {
                console.log(req.query.userEmail);
                console.log(isMicrosoft(req.query.userEmail));
                if (!isMicrosoft(req.query.userEmail)) {
                    if (fb.submitterEmail) {
                        delete fb.submitterEmail;
                    }

                    if (fb.id) { delete fb.id; }
                }
                console.log(fb);


                getStateAndReason(validationId, fb, function (updatedFeedback) {
                    if (updatedFeedback.upvotes) {
                        updatedFeedback.userUpvoted = updatedFeedback.upvotes.includes(req.body.userEmail);
                    } else {
                        updatedFeedback.userUpvoted = false;
                    }
                    result.push(updatedFeedback);
                    feedbackDone++;
                    checkIfDone();
                });
            });
        });
    }

    this.addFeedback = function (req, res) {
        console.log("addFeedback got called");
        console.log(req.body);

        let validationId = safeOid(req.body.validationId);
        const windowsBuildType = req.body.windowsBuildType;
        const windowsBuildVersion = req.body.windowsBuildVersion;

        let valQuery = {
            _id: validationId
        };

        let feedbackObj = {
            tap: "Windows",
            title: req.body.title,
            text: req.body.text,
            submitterEmail: req.body.submitterEmail,
            validationId: validationId,
            timestamp: new Date(),
            public: req.body.public,
            windowsBuildType: windowsBuildType,
            windowsBuildVersion: windowsBuildVersion,
            upvotes: [],
            comments: [],
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

            //let description = '"' + req.body.text + '"<br /><strong>Submitter</strong>: ' + userEmail + " (" + req.body.submitterEmail + ")";
            let description = getWindowsReproSteps(req.body);

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

                if (valDoc.areaPath) {
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
                    /*
                    if (userEmail) {
                        reqBody.push({
                            "op": "add",
                            "path": "/fields/OSG.Partner.PartnerPOC",
                            "value": userEmail
                        });
                    }
                    */

                    if (windowsBuildVersion) {
                        reqBody.push({
                            "op": "add",
                            "path": "/fields/Microsoft.VSTS.Build.FoundIn",
                            "value": windowsBuildVersion
                        });
                    }

                    reqBody.push({
                        "op": "add",
                        "path": "/fields/Microsoft.VSTS.Common.Release",
                        "value": "Cobalt"
                    });
                    /*

                    // ProductFamily
                    if (valDoc.productFamily) {
                        reqBody.push({
                            "op": "add",
                            "path": "/fields/OSG.ProductFamily",
                            "value": valDoc.productFamily
                        });
                    }

                    // Product
                    if (valDoc.product) {
                        reqBody.push({
                            "op": "add",
                            "path": "/fields/OSG.Product",
                            "value": valDoc.product,
                        });
                    }

                    // Release
                    if (valDoc.release) {
                        reqBody.push({
                            "op": "add",
                            "path": "/fields/Microsoft.VSTS.Common.Release",
                            "value": valDoc.release,
                        });
                    } else {
                        reqBody.push({
                            "op": "add",
                            "path": "/fields/Microsoft.VSTS.Common.Release",
                            "value": "Cobalt"
                        });
                    }

                    // Found in Env
                    if (valDoc.foundInEnv) {
                        reqBody.push({
                            "op": "add",
                            "path": "/fields/Microsoft.VSTS.CMMI.FoundInEnvironment",
                            "value": valDoc.foundInEnv,
                        });
                    }
                    */

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
                    feedbackObj.publicId = ObjectID();

                    console.log(vstsResponse);
                    console.log(vstsResponse.id);
                    console.log(feedbackObj);

                    feedback.insertOne(feedbackObj, function (err, feedbackDoc) {
                        if (err) { console.log(err); }

                        // Handle attachments
                        if (req.body.attachments) {
                            if (req.body.attachments.length > 0) {
                                console.log("Handling attachments");
                                console.log(feedbackObj);
                                console.log(feedbackObj.validationId);
                                getAuthForCase(feedbackObj.validationId, function (err, project) {
                                    console.log(project);
                                    uploadAttachments(req.body.attachments, feedbackObj._id, project, function (attachmentBodies) {
                                        //console.log(attachmentBodies);
                                        return res.status(200).send();
                                    });
                                });
                            } else {
                                return res.status(200).send();
                            }
                        }
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

        let id = safeOid(req.params.id);

        let op = { $set: {} };
        if ('text' in req.body) {
            op["$set"].text = req.body.text;
        }
        if ('title' in req.body) {
            op["$set"].title = req.body.title;
        }
        if ('public' in req.body) {
            op["$set"].public = req.body.public;
        }

        console.log(op);

        let query = { _id: id };

        feedback.findOneAndUpdate(query, op, { returnOriginal: false }, function (err, feedbackDoc) {
            if (err) { throw err; }

            feedbackDoc = feedbackDoc.value;

            updateWorkitem(id, function (err, status) {
                console.log(status);
                console.log("Updated");

                // Handle attachments
                if (req.body.attachments) {
                    if (req.body.attachments.length > 0) {
                        console.log("Handling attachments");
                        console.log(feedbackDoc);
                        console.log(feedbackDoc.validationId);
                        getAuthForCase(feedbackDoc.validationId, function (err, project) {
                            console.log(project);
                            uploadAttachments(req.body.attachments, id, project, function (attachmentBodies) {
                                console.log(attachmentBodies);
                                return res.status(200).send();
                            });
                        });
                    } else {
                        return res.status(200).send();
                    }
                } else {
                    return res.status(200).send();
                }

                return res.status(200).send();
            });
        });
    }

    function updateWorkitem(id, callback) {
        // Single function for syncing the changes in the DB obj to the ADO workitem.
        id = safeOid(id);
        feedback.findOne({ _id: id }, function (err, feedbackDoc) {
            console.log(feedbackDoc);
            let safeTitle = feedbackDoc.title || "Untitled";
            if (safeTitle.length > 120) {
                safeTitle = safeTitle.substring(0, 117) + "...";
            }

            let reproSteps = getWindowsReproSteps(feedbackDoc);

            var reqBody = [
                {
                    "op": "add",
                    "path": "/fields/System.Title",
                    "value": safeTitle
                },
                {
                    "op": "add",
                    "path": "/fields/Microsoft.VSTS.TCM.ReproSteps",
                    "value": reproSteps
                }
            ];

            getAuthForCase(feedbackDoc.validationId, function (err, project) {
                if (err) { throw err; }
                let endpoint = ADO_WORKITEM_EDIT_ENDPOINT
                    .replace("{org}", project.org)
                    .replace("{project}", project.project)
                    .replace("{id}", id);
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
                    callback(vstsErr, resp.statusCode);
                });
            });
        });
    }

    this.upvoteFeedback = function (req, res) {
        console.log(req.body);

        let id = safeOid(req.params.id);

        feedback.findOne({ _id: id }, function (err, feedbackDoc) {
            if (feedbackDoc) {
                feedback.findOneAndUpdate({ _id: id }, { $addToSet: { upvotes: req.body.email } }, { returnOriginal: false }, function (err, updatedDoc) {
                    console.log("About to call updateWorkitem");
                    updateWorkitem(id, function (err, updateDoc) {
                        return res.status(200).send();
                    });
                });
            } else {
                return res.status(404).send();
            }
        });
    }

    this.commentOnFeedback = function (req, res) {
        console.log(req.body);

        let id = safeOid(req.params.id);
        console.log(id);

        let commentObj = {
            email: req.body.email,
            comment: req.body.comment
        }

        feedback.findOne({ _id: id }, function (err, feedbackDoc) {
            if (feedbackDoc) {
                feedback.findOneAndUpdate({ _id: id }, { $addToSet: { comments: commentObj } }, { returnOriginal: false }, function (err, updatedDoc) {
                    updateWorkitem(id, function (err, statusCode) {
                        console.log(statusCode);
                        console.log("Updated workitem");
                        return res.status(200).send();
                    });
                });
            } else {
                return res.status(404).send();
            }
        });
    }

};

module.exports = feedbackHandler;