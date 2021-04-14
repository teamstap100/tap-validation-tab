'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');
const { safeOid, patToAuth, ADO_API_BASE, cleanEmail } = require(process.cwd() + "/app/helpers/helpers.server.js");

function getWindowsReproSteps(body) {
    let tableStyle = "border: solid black 1px; padding: 4px 4px 4px 4px;";

    // Take a bug and create Windows repro steps for it.
    let reproSteps = `<br /><table style='${tableStyle}'><tbody>`;

    // Original description
    reproSteps += `<tr style='${tableStyle}'> <td style='${tableStyle}'> Details </td> <td style='${tableStyle}'>${body.description} </td></tr>`;

    // Submitter
    let userEmail;
    if (body.email) {
        userEmail = body.email;
    } else if (body.userEmail) {
        userEmail = body.userEmail;
    } else if (body.submitterEmail) {
        userEmail = body.submitterEmail;
    }

    //  User email
    //reproSteps += `<tr style='${tableStyle}'> <td style='${tableStyle}'> Submitter </td> <td id='userEmail' style='${tableStyle}'>${userEmail} </td></tr>`;

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

function featureRequestHandler(dbParent) {
    var db = dbParent.db("clementine");
    var validations = db.collection('validations');
    var projects = db.collection("adoProjects");

    var featureRequests = db.collection('featureRequests');

    const ENV = process.env.ENV;

    const ADO_WORKITEM_ADD_ENDPOINT = ADO_API_BASE + "workitems/$Bug?api-version=4.11";
    const ADO_WORKITEM_EDIT_ENDPOINT = ADO_API_BASE + "workitems/{id}?api-version=5.1";
    const ADO_WORKITEM_GET_ENDPOINT = ADO_API_BASE + "workitems/{id}?api-version=5.1";

    function getAuthForCase(validationId, callback) {
        validations.findOne({ _id: safeOid(validationId) }, function (err, valDoc) {
            projects.findOne({ _id: safeOid(valDoc.project) }, function (err, projectDoc) {
                projectDoc.auth = patToAuth(projectDoc.pat);

                return callback(err, projectDoc);
            });
        });
    }

    this.getFeatureRequestsByUser = function (req, res) {
        //let validationId = parseInt(req.body.validationId);
        let validationId = safeOid(req.query.validationId);
        let userEmail = req.query.userEmail;

        // Get all featureRequest submitted by this user, or others' public featureRequest
        let featureRequestQuery = {
            validationId: safeOid(validationId),
            submitterEmail: userEmail,
        };

        var freqs = [];
        var freqsDone = 0;
        var freqCount = 0;

        function checkIfDone() {
            if (freqsDone == freqCount) {
                return res.json({ featureRequest: freqs });
            }
        }

        featureRequests.find(featureRequestQuery).toArray(function (err, featureRequestDocs) {
            freqCount = featureRequestDocs.length;
            if (freqCount == 0) {
                return res.json({ featureRequest: [] });
            }

            featureRequestDocs.forEach(function (freq) {

                getAuthForCase(validationId, function (err, project) {
                    if (err) { throw err; }
                    let ado_endpoint = ADO_WORKITEM_GET_ENDPOINT
                        .replace("{org}", project.org)
                        .replace("{project}", project.project)
                        .replace("{id}", freq._id);

                    const options = {
                        url: ado_endpoint,
                        headers: {
                            'Authorization': project.auth,
                        }
                    };

                    request.get(options, function (err, resp, body) {
                        try {
                            body = JSON.parse(body);

                            freq.state = body.fields["System.State"];
                            freq.reason = body.fields["Microsoft.VSTS.Common.ResolvedReason"] || body.fields["System.Reason"];
                        } catch (e) {
                            freq.state = "New";
                            freq.reason = "New";
                        }

                        freqs.push(freq);
                        freqsDone++;
                        checkIfDone();
                    });
                });
            });
        });
    }

    this.getPublicFeatureRequests = function (req, res) {
        // Get the public featureRequest not by this user.
        let validationId = safeOid(req.query.validationId);
        //let validationId = parseInt(req.body.validationId);
        let userEmail = req.query.userEmail;

        // Get all featureRequest submitted by this user, or others' public featureRequest
        let featureRequestQuery = {
            validationId: validationId,
            submitterEmail: { $ne: userEmail },
            public: true,
        };

        featureRequests.find(featureRequestQuery).toArray(function (err, featureRequestDocs) {
            featureRequestDocs.forEach(function (doc) {
                if (!(doc.submitterEmail == userEmail)) {
                    doc.submitterEmail = "someone else";
                    doc.showEditButton = false;
                } else {
                    doc.showEditButton = true;
                }
            });
            return res.json({ featureRequest: featureRequestDocs });
        });
    }

    this.addFeatureRequest = function (req, res) {
        console.log("addFeatureRequest got called");
        console.log(req.body);

        // Temp
        //req.body.submitterEmail = "someone@gmail.com";

        let validationId = safeOid(req.body.validationId);

        let featureRequestObj = {
            tap: "Windows",
            title: req.body.title,
            description: req.body.description,
            submitterEmail: req.body.submitterEmail,
            validationId: safeOid(validationId),
            timestamp: new Date(),
            public: req.body.public,
            upvotes: [req.body.submitterEmail],
            downvotes: [],
        };

        let valQuery = {
            _id: safeOid(req.body.validationId)
        };

        validations.findOne(valQuery, {projection: { tag: 1, areaPath: 1 }}, function (err, valDoc) {
            let tags = "WCCP; WCCP-FeatureRequest; " + valDoc.tag;

            //let systemInfo = "<strong>Build Type</strong>: " + body.windowsBuildType + "<br />";
            //systemInfo += "<strong>Build Version</strong>: " + body.windowsBuildVersion + "<br />";

            let safeTitle = "Feature Request - " + req.body.title;
            if (safeTitle.length > 120) {
                safeTitle = safeTitle.substring(0, 117) + "...";
            }

            let userEmail = cleanEmail(req.body.submitterEmail);

            let description = getWindowsReproSteps(req.body);

            //let description = '"' + req.body.description + '"<br /><strong>Submitter</strong>: ' + userEmail + " (" + req.body.submitterEmail + ")";

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

                    if (req.body.windowsBuildVersion) {
                        reqBody.push({
                            "op": "add",
                            "path": "/fields/Microsoft.VSTS.Build.FoundIn",
                            "value": req.body.windowsBuildVersion
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
                            "value": valDoc.product
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
                            "value": valDoc.foundInEnv
                        });
                    }
                    */
                }

                let ado_add_endpoint = ADO_WORKITEM_ADD_ENDPOINT
                    .replace("{org}", project.org)
                    .replace("{project}", project.project);

                const options = {
                    url: ado_add_endpoint,
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
                    featureRequestObj._id = vstsResponse.id;
                    featureRequestObj.publicId = new ObjectID();

                    console.log(featureRequestObj);

                    featureRequests.insertOne(featureRequestObj, function (err, featureRequestDoc) {
                        if (err) { console.log(err); throw err; }
                        console.log("Created it");
                        res.status(200).send();
                    });
                });
            });
        });
    }

    this.modifyFeatureRequest = function (req, res) {
        console.log(req.params);
        console.log(req.body);

        let op = {
            $set: {
                title: req.body.title,
                description: req.body.description,
                public: req.body.public
            }
        };

        /*
        if ('title' in req.body) {
            op = { $set: { title: req.body.title } };
        } if ('description' in req.body) {
            op = { $set: { description: req.body.description } };

        }  if ('public' in req.body) {
            op = { $set: { public: req.body.public } };
        }
        */

        let query = { _id: parseInt(req.params.id) };

        featureRequests.findOneAndUpdate(query, op, { returnOriginal: false }, function (err, featureRequestDoc) {
            if (err) { throw err; }
            let updatedDoc = featureRequestDoc.value;
            // Write changes to ADO
            let safeTitle = "FeatureRequest - " + updatedDoc.title;
            if (safeTitle.length > 120) {
                safeTitle = safeTitle.substring(0, 117) + "...";
            }
            let description = getWindowsReproSteps(updatedDoc);
            //let description = '"' + updatedDoc.description + '"<br /><strong>Submitter</strong>: ' + updatedDoc.submitterEmail;

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
            getAuthForCase(updatedDoc.validationId, function (err, project) {
                let ado_edit_endpoint = ADO_WORKITEM_EDIT_ENDPOINT
                    .replace("{org}", project.org)
                    .replace("{project}", project.project)
                    .replace("{id}", req.params.id)

                const options = {
                    url: ado_edit_endpoint,
                    headers: {
                        'Authorization': project.auth,
                        'Content-Type': 'application/json-patch+json'
                    },
                    body: JSON.stringify(reqBody)
                };

                request.patch(options, function (vstsErr, resp, body) {
                    if (vstsErr) { console.log(vstsErr); }
                    console.log(resp.statusCode);

                    res.status(200).send();
                });

                return res.status(200).send();
            });
        });
    }

    this.addSupport = function (req, res) {
        console.log(req.body);

        let freqId = parseInt(req.params.id);

        let query = { _id: freqId };

        featureRequests.updateOne(query, {
            $addToSet: {
                upvotes: req.body.userEmail
            }
        }, function(err, freqDoc) {
            console.log(freqDoc);
            res.status(200).send();
        });
    }

    this.getUserSupports = function (req, res) {
        //let validationId = parseInt(req.body.validationId);
        let validationId = safeOid(req.query.validationId);

        let query = { upvotes: req.query.email, validationId: validationId };

        console.log(query);

        featureRequests.find(query).toArray(function (err, freqDocs) {
            res.json({ featureRequests: freqDocs });
        });
    }
};

module.exports = featureRequestHandler;