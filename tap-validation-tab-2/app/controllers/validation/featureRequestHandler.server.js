'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');
const { safeOid, patToAuth, ADO_API_BASE } = require(process.cwd() + "/app/helpers/helpers.server.js");

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

    this.getFeatureRequestsByUser = function (req, res) {
        console.log(req.body);
        //let validationId = parseInt(req.body.validationId);
        let validationId = req.body.validationId;
        let userEmail = req.body.userEmail;

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

                getAuthForCase(req.body.validationId, function (err, project) {
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
                            console.log(body.fields["System.State"]);
                            console.log(body.fields["System.Reason"]);

                            freq.state = body.fields["System.State"];
                            freq.reason = body.fields["System.Reason"];
                        } catch (e) {
                            console.log(e);
                            console.log("Falling back on default");
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
        console.log(req.body);
        let validationId = req.body.validationId;
        //let validationId = parseInt(req.body.validationId);
        let userEmail = req.body.userEmail;

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
        console.log(req.body);

        // Temp
        //req.body.submitterEmail = "someone@gmail.com";

        //let validationId = parseInt(req.body.validationId);
        let validationId = req.body.validationId;

        let featureRequestObj = {
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

        console.log(valQuery);

        validations.findOne(valQuery, {projection: { tag: 1, areaPath: 1 }}, function (err, valDoc) {
            let tags = "WCCP; WCCP-FeatureRequest; " + valDoc.tag;

            //let systemInfo = "<strong>Build Type</strong>: " + body.windowsBuildType + "<br />";
            //systemInfo += "<strong>Build Version</strong>: " + body.windowsBuildVersion + "<br />";

            let safeTitle = "Feature Request - " + req.body.title;
            if (safeTitle.length > 120) {
                safeTitle = safeTitle.substring(0, 117) + "...";
            }

            let userEmail = cleanEmail(req.body.submitterEmail);

            let description = '"' + req.body.description + '"<br /><strong>Submitter</strong>: ' + userEmail + " (" + req.body.submitterEmail + ")";

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

                    featureRequests.insertOne(featureRequestObj, function (err, featureRequestDoc) {
                        res.status(200).send();
                    });
                });
            });
        });
    }

    this.modifyFeatureRequest = function (req, res) {
        console.log(req.params);
        console.log(req.body);
        console.log(req.body.public)

        let op = {};
        if ('title' in req.body) {
            op = { $set: { title: req.body.title } };
        } else if ('description' in req.body) {
            op = { $set: { description: req.body.description } };

        } else if ('public' in req.body) {
            op = { $set: { public: req.body.public } };
        }

        console.log(op);

        let query = { _id: parseInt(req.params.id) };

        featureRequests.findOneAndUpdate(query, op, { returnOriginal: false }, function (err, featureRequestDoc) {
            if (err) { throw err; }
            let updatedDoc = featureRequestDoc.value;
            console.log(featureRequestDoc);
            // Write changes to ADO
            let safeTitle = "FeatureRequest - " + updatedDoc.title;
            if (safeTitle.length > 120) {
                safeTitle = safeTitle.substring(0, 117) + "...";
            }
            let description = '"' + updatedDoc.description + '"<br /><strong>Submitter</strong>: ' + updatedDoc.submitterEmail;

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
            getAuthForCase(featureRequestDoc.validationId, function (err, project) {
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
        let validationId = req.body.validationId;

        let query = { upvotes: req.body.email, validationId: validationId };

        console.log(query);

        featureRequests.find(query).toArray(function (err, freqDocs) {
            console.log("Found these feature requests");
            console.log(freqDocs);
            res.json({ featureRequests: freqDocs });
        });
    }
};

module.exports = featureRequestHandler;