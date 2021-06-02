'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');
var atob = require('atob');
const fs = require('fs');
const path = require('path');
const { safeOid, patToAuth, ADO_API_BASE, uploadAttachments, isMicrosoft, cleanEmail } = require('../../helpers/helpers.server');

function caseHandler(dbParent) {

    // "db.collection is not a function"
    var db = dbParent.db("clementine");
    var cases = db.collection('cases');
    var tenants = db.collection('tenants');
    var votes = db.collection('votes');
    var validations = db.collection('validations');
    var projects = db.collection("adoProjects");

    const ENV = process.env.ENV;

    const ADO_WORKITEM_ADD_ENDPOINT = ADO_API_BASE + "workitems/${{WORKITEM_TYPE}}?api-version=4.11";
    const ADO_WORKITEM_UPDATE_ENDPOINT = ADO_API_BASE + "workitems/{id}?api-version=4.1";
    const ADO_WORKITEM_GET_ENDPOINT = ADO_API_BASE + "workitems/{id}?api-version=4.1";
    
    const TEAMS_ADO_API_BASE = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/";
    const TEAMS_ADO_WORKITEM_ADD_ENDPOINT = TEAMS_ADO_API_BASE + "workitems/$Bug?api-version=4.11";
    const TEAMS_ADO_WORKITEM_UPDATE_ENDPOINT = TEAMS_ADO_API_BASE + "workitems/{id}?api-version=4.1";

    // This one's for production
    const AUTH = process.env["TEAMS-ADO-PAT"];

    function getDomain(email) {
        var domain = "?";
        if (!email) {
            return domain;
        }

        if (email.includes("@")) {
            var atParts = email.split("@");
            domain = atParts.pop();
            var tenantString = domain.split(".")[0];

        } else if (email.includes("_")) {
            console.log("Going the underscore route");
            var underscoreParts = email.split("_");
            domain = underscoreParts.pop();
            var tenantString = domain.split(".")[0];

            if (underscoreParts.length > 1) {
                email = underscoreParts.join("_") + "@" + domain;
            } else {
                email = underscoreParts[0] + "@" + domain;
            }
        }
        console.log(domain);

        if (domain.includes(".microsoft.com")) {
            domain = "microsoft.com";
        }

        return domain.toLowerCase();
    }

    function getWindowsReproSteps(body) {
        let tableStyle = "border: solid black 1px; padding: 4px 4px 4px 4px;";


        // Take a bug and create Windows repro steps for it.
        let reproSteps = `<br /><table style='${tableStyle}'><tbody>`;

        // Original description
        reproSteps += `<tr style='${tableStyle}'> <td style='${tableStyle}'> Details </td> <td style='${tableStyle}'>${body.comment} </td></tr>`;

        // Submitter
        let userEmail;
        if (body.email) {
            userEmail = body.email;
        } else if (body.userEmail) {
            userEmail = body.userEmail;
        } else if (body.submitterEmail) {
            userEmail = body.submitterEmail;
        }

        userEmail = cleanEmail(userEmail);


        // User email
        //reproSteps += `<tr style='${tableStyle}'> <td style='${tableStyle}'> Submitter </td> <td id='userEmail' style='${tableStyle}'>${userEmail} </td></tr>`;

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
        // Get the project details for a given validation.
        validations.findOne({ _id: safeOid(validationId) }, function (err, valDoc) {
            projects.findOne({ _id: safeOid(valDoc.project) }, function (err, projectDoc) {
                projectDoc.auth = patToAuth(projectDoc.pat);

                return callback(err, projectDoc);
            });
        });
    }

    this.getOneCase = function (req, res) {
        var refUrlParts = req.url.split('/');
        const cId = parseInt(refUrlParts.pop());

        // case IDs are just ints, not OIDs
        //var query = { "_id": ObjectID(cId) };
        var query = { "_id": cId };
        cases.findOne(query, {}, function (err, doc) {
            if (err) { throw err; }

            res.json(doc);
            //console.log(doc);
        })
    }

    this.getCaseVotesByCustomer = function (req, res) {
        let tenantProjection = {
            name: 1,
            tid: 1,
            parent: 1,
        };

        //console.log("Calling getCaseVotesByCustomer with body:");
        //console.log(req.body);
        const email = req.query.email;
        var cId = req.query.cId;
        const upDown = req.query.upDown;

        var query = {};

        if (isNaN(cId)) {
            query._id = ObjectID(cId);
        } else {
            query._id = parseInt(cId);
        }
        
        //console.log(query);
        let domain = getDomain(email);

        tenants.findOne({ domains: domain }, { projection: tenantProjection }, function (err, tenantObj) {
            let tids = [];
            let tenantName = null;

            if (tenantObj) {
                if (tenantObj.parent) {
                    tenants.findOne({ tid: tenantObj.parent }, { projection: tenantProjection }, function (err, parentTenantObj) {
                        tids = [tenantObj.tid, parentTenantObj.tid];
                        getVotes(tids, parentTenantObj.name);
                    });
                } else {
                    tids = [tenantObj.tid];
                    getVotes(tids, tenantObj.name);
                }
            } else {
                //console.log("No tenant found, let's just go by email");
                //return res.status(400).send();
                getVotes([], "?");
            }
        });

        function getVotes(tids, tenantName) {

            cases.findOne(query, { upvotes_v2: 1, downvotes_v2: 1 }, function (err, doc) {
                if (err) { throw err; }

                //console.log(doc);

                let voteObjs = [];
                let votes = [];

                if (upDown == "up") {
                    voteObjs = doc.upvotes_v2;
                } else {
                    voteObjs = doc.downvotes_v2;
                }

                voteObjs.forEach(function (vote) {
                    //console.log(email);
                    if ((tids.includes(vote.tenantId)) || (tenantName == "Microsoft") || (vote.email == email) || (vote.public)) {
                        let voteString = vote.email;
                        if (vote.client) {
                            voteString += " (" + vote.client + ")";
                        }

                        if ((vote.device && vote.teamsMode)) {
                            voteString += " (" + vote.device + " - " + vote.teamsMode + ")";
                        }

                        if ((vote.device && vote.headset)) {
                            voteString += " (" + vote.device + " - " + vote.headset + ")";
                        }

                        if (vote.device) {
                            voteString += " (" + vote.device + ")";
                        }

                        if (vote.windowsBuildVersion) {
                            voteString += " (" + vote.windowsBuildVersion + ")";
                        }

                        if (vote.comment) {
                            //console.log(vote);
                            //console.log(vote.email, email);
                            // TODO: Currently the client logic checks for this user's email in the string when deciding what to do with buttons and such.
                            // It'd be better to include a boolean for "it's this user" and do that stuff in the ajaxRefresh function.
                            // For now we are includiing the user's email in the string to keep this funcitonality.
                            //if (vote.email == email) {
                            //    voteString = '"' + vote.comment + '" - ' + vote.email;
                            //} else {
                            //    voteString = '"' + vote.comment + '"';
                            // }
                            if (vote.publicId) {
                                voteString = '(' + vote.publicId + ') "' + vote.title + '"';
                            } else if (vote.id) {
                                voteString = '(' + vote.id + ') "' + vote.comment + '"';
                            } else {
                                voteString = '"' + vote.comment + '"';
                            }
                        }

                        let userFacingVote = {
                            text: voteString,
                            currentUser: vote.email == email
                        };

                        //votes.push([voteString,]);
                        votes.push(userFacingVote);
                    }
                })

                // Sort alphabetically
                // TODO: Redo using properties
                //votes.sort();

                //console.log(votes);

                res.json({
                    votes: votes
                });
            })
        }
    }

    // Add a comemnt to the case's workitem.
    this.addComment = function (req, res) {
        console.log("Called addComment");
        console.log(req.body);
        var cId = req.body.cId;
        var tap = req.body.tap;
        var title = req.body.title;
        const comment = req.body.comment;
        const userEmail = req.body.userEmail;
        const commentIsPublic = req.body.public;

        let specialFields = ['device', 'headset', 'networkScenarios'];

        if (isNaN(cId)) {
            cId = ObjectID(cId);
        } else {
            cId = parseInt(cId);
        }

        console.log(userEmail);

        var clientVoteString = cleanEmail(userEmail);
        var domain = getDomain(clientVoteString);

        if (clientVoteString.includes("undefined")) {
            clientVoteString = userEmail;
            tenantString = clientVoteString.split("@")[1].split(".")[0];
        }

        req.body.cleanEmail = clientVoteString;

        tenants.findOne({ domains: domain }, function (err, tenantDoc) {
            console.log("TenantDoc:", tenantDoc);
            if (err) { throw err; }

            var realTenantId = "?";
            var realTenantName = "?";
            if (tenantDoc != null) {
                realTenantId = tenantDoc.tid;
                realTenantName = tenantDoc.name;
            }

            req.body.tenantId = realTenantId;
            req.body.tenantName = realTenantName;

            var commentDoc = {
                comment: comment,
                userEmail: clientVoteString,
                userTenantId: realTenantId,
                userTenantName: realTenantName,
                timestamp: new Date(),
            }

            if (commentIsPublic != null) {
                commentDoc.public = commentIsPublic;
            }

            if (title != null) {
                commentDoc.title = title;
            }

            specialFields.forEach(function (field) {
                if (req.body[field]) {c
                    commentDoc[field] = req.body[field];
                }
            });

            if (tap == "Teams") {
                //console.log("Now putting this in VSTS");
                var reqBody = [
                    {
                        op: "add",
                        path: "/fields/System.History",
                        value: "'" + comment + "' - " + clientVoteString
                    }
                ];

                var update_endpoint = TEAMS_ADO_WORKITEM_UPDATE_ENDPOINT.replace("{id}", cId);

                const options = {
                    url: update_endpoint,
                    headers: {
                        'Authorization': AUTH,
                        'Content-Type': 'application/json-patch+json'
                    },
                    body: JSON.stringify(reqBody)
                };

                request.patch(options, function (vstsErr, vstsResp, vstsBody) {
                    if (vstsErr) { console.log(vstsErr); }
                    //console.log("Vsts response was: " + vstsBody);

                    createTeamsBug(req.body, function (workitemBody) {
                        if (workitemBody.id) {
                            commentDoc.id = workitemBody.id;
                        }

                        cases.updateOne({ _id: cId }, { $push: { comments: commentDoc } }, function (err, result) {
                            return res.status(200).send();
                        });
                    })
                });
            } else if (tap == "Windows") {
                console.log("Comment for Windows TAP");
                let valQuery = {};
                if (isNaN(req.body.validationId)) {
                    valQuery._id = ObjectID(req.body.validationId);
                } else {
                    valQuery._id = parseInt(req.body.validationId);
                }

                //console.log(valQuery);

                validations.findOne(valQuery, function (err, valDoc) {
                    if (valDoc) {
                        req.body.validation = valDoc;

                        createWindowsBug(req.body, function (workitemBody, attachmentBody) {
                            console.log(workitemBody);

                            console.log("Setting id: " + workitemBody.id);
                            commentDoc.id = workitemBody.id;
                            commentDoc.publicId = new ObjectID();

                            cases.updateOne({ _id: cId }, { $push: { comments: commentDoc } }, function (err, result) {
                                return res.status(200).send();
                            });
                        });
                    } else {
                        console.log("valDoc not found");
                        // TODO: Do I just not create a comment here? Werid
                        return res.status(200).send();
                    }
                });
            } else if (tap == "ACS") {
                console.log("Comment for ACS TAP");

                specialFields.forEach(function (field) {
                    if (req.body[field]) {
                        commentDoc[field] = req.body[field];
                    }
                });
                

                cases.updateOne({ _id: cId }, { $push: { comments: commentDoc } }, function (err, result) {
                    if (err) { console.log(err); }
                    return res.status(200).send();
                });

            } else {
                console.log("Tap wasn't teams or windows; not yet implemented");
                return res.status(200).send();
            }

        });
    };

    function createTeamsBug(body, callback) {
        console.log(body);
        let bugTitle = "TVT Comment: "
        let tags = body.tag + "; TAPValidationComment; TAP; Ring1_5;";

        let safeComment = body.comment.replace(/\r?\n/g, '<br />');
        bugTitle += '"' + safeComment + '"';

        if (bugTitle.length > 200) {
            bugTitle = bugTitle.slice(0, 197) + "...";
        }

        let cleanedEmail = cleanEmail(body.userEmail);

        let annotatedComment = '"' + safeComment + '" - ' + cleanedEmail + "<br />Submitted for scenario '" + body.caseTitle + "' (#" + body.cId + ") in validation " + body.tag;

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
                "path": "/fields/Microsoft.VSTS.TCM.ReproSteps",
                "value": annotatedComment,
            },
            {
                "op": "add",
                "path": "/fields/System.AreaPath",
                "value": "MSTeams\\Customer Feedback\\TAP"
            },
            {
                "op": "add",
                "path": "/fields/MicrosoftTeamsCMMI.CustomerName",
                "value": body.tenantId,
            },
            {
                "op": "add",
                "path": "/fields/MicrosoftTeamsCMMI.CustomerEmail",
                "value": cleanedEmail,
            },
            {
                "op": "add",
                "path": "/fields/MicrosoftTeamsCMMI.CustomerTenantName",
                "value": body.tenantName
            }
        ];

        let apiUrl = TEAMS_ADO_WORKITEM_ADD_ENDPOINT;

        const options = {
            url: apiUrl,
            headers: {
                'Authorization': AUTH,
                'Content-Type': 'application/json-patch+json'
            },
            body: JSON.stringify(reqBody)
        };

        console.log("Create workitem options:");
        console.log(options);

        request.post(options, function (vstsErr, vstsResp, vstsBody) {
            if (vstsErr) { throw vstsErr; }

            console.log(vstsBody);
            return callback(vstsBody);

        });
    }

    function createWindowsBug(body, callback) {
        // Add the new bug to VSTS

        console.log(body);

        let bugTitle = `[${body.caseTitle}] `;
        let tags = body.tag + ";" + "WCCP;" + body.caseTitle;

        // TODO: This is just Bug all the time
        let workitemType = "Bug";

        if (body.upDown == "up") {
            tags += "; WCCP-Works";

            // TODO: Pick a better workitem type for this
            workitemType = "Bug";

        } else if (body.upDown == "down") {
            tags += "; WCCP-Fails";
        } else if (body.upDown == "comment") {
            tags += "; WCCP-Feedback";

            workitemType = "Bug";
        }

        let safeComment = body.title.replace(/\r?\n/g, '<br />');
        bugTitle += safeComment;

        if (bugTitle.length > 200) {
            bugTitle = bugTitle.slice(0, 197) + "...";
        }

        let reproSteps = getWindowsReproSteps(body);

        var reqBody = [
            {
                "op": "add",
                "path": "/fields/System.Title",
                "value": safeComment
            },
            {
                "op": "add",
                "path": "/fields/System.Tags",
                "value": tags,
            },
            {
                "op": "add",
                "path": "/fields/Microsoft.VSTS.TCM.ReproSteps",
                "value": reproSteps
            },
        ];

        getAuthForCase(body.validation._id, function (err, project) {
            let valDoc = body.validation;

            if (valDoc.areaPath) {
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
                // This area path only works in production, in the microsoft/OS project

                if (body.cleanEmail) {
                    /*
                    reqBody.push({
                        "op": "add",
                        "path": "/fields/OSG.Partner.PartnerPOC",
                        "value": body.cleanEmail
                    });
                    */
                }

                if (body.windowsBuildVersion) {
                    reqBody.push({
                        "op": "add",
                        "path": "/fields/Microsoft.VSTS.Build.FoundIn",
                        "value": body.windowsBuildVersion
                    });
                }

                reqBody.push({
                    "op": "add",
                    "path": "/fields/Microsoft.VSTS.Common.Release",
                    "value": "Cobalt"
                });

            }

            if (project.org == "MSFTDEVICES") {
                reqBody.push({
                    "op": "Add",
                    "path": "/fields/Microsoft.VSTS.Common.Bug.BugBugType",
                    "value": "Suggestion"
                });

                reqBody.push({
                    "op": "Add",
                    "path": "/fields/Microsoft.VSTS.Common.Priority",
                    "value": "3"
                })
            }

        
            var apiUrl = ADO_WORKITEM_ADD_ENDPOINT
                .replace("{org}", project.org)
                .replace("{project}", project.project)
                .replace("{{WORKITEM_TYPE}}", workitemType);

            const options = {
                url: apiUrl,
                headers: {
                    'Authorization': project.auth,
                    'Content-Type': 'application/json-patch+json'
                },
                body: JSON.stringify(reqBody)
            };

            console.log(JSON.stringify(reqBody, null, 2));

            console.log("Create workitem options:");
            console.log(options);

            request.post(options, function (vstsErr, vstsResp, vstsBody) {
                if (vstsErr) { throw vstsErr; }

                console.log(vstsResp.statusCode);

                vstsBody = JSON.parse(vstsBody);
                console.log(JSON.stringify(vstsBody, null, 2));

                let bugId = vstsBody.id;

                if (body.attachments.length > 0) {
                    uploadAttachments(body.attachments, bugId, project, function (attachmentBodies) {
                        return callback(vstsBody, attachmentBodies);
                    });
                } else {
                    return callback(vstsBody, null);
                }
            });
        });

    }

    this.getCaseVoteByUser = function (req, res) {
        //console.log(req.body);

        let cId = req.params.cId;

        if (isNaN(cId)) {
            cId = ObjectID(cId);
        } else {
            cId = parseInt(cId);
        }

        cases.findOne({ _id: cId }, function (err, caseDoc) {
            if (caseDoc == null) {
                return res.json({ votes: [] });
            }
            //console.log(caseDoc);
            let upvote = caseDoc.upvotes_v2.find(vote => vote.email == req.params.user)
            let downvote = caseDoc.downvotes_v2.find(vote => vote.email == req.params.user)

            //console.log(upvote);
            //console.log(downvote);

            if (req.params.upDown == "up") {
                if (upvote) {
                    return res.json({ votes: [upvote] });
                } else {
                    return res.json({ votes: [] });
                }
            } else {
                if (downvote) {
                    return res.json({ votes: [downvote] });


                } else {
                    return res.json({ votes: [] });
                }
            }
        });

        
    }

    this.addVote = function (req, res) {
        console.log("addVote got called");

        console.log(req.body);

        //var refUrlParts = req.url.split('/');
        //console.log("cid was " + req.body.cId);
        var cId = req.body.cId;
        const url = req.body.url;
        const userEmail = req.body.userEmail;
        const upDown = req.body.upDown;

        var specialFields = ['client', 'device', 'headset', 'networkScenarios', 'teamsMode', 'windowsBuildType', 'windowsBuildVersion'];

        const client = req.body.client;
        const device = req.body.device;
        const headset = req.body.headset;
        const teamsMode = req.body.teamsMode;
        const networkScenarios = req.body.networkScenarios;

        const windowsBuildType = req.body.windowsBuildType;
        const windowsBuildVersion = req.body.windowsBuildVersion;

        const comment = req.body.comment;

        const tap = req.body.tap;

        const votePublic = req.body.public;

        let lightTenantProjection = {
            name: 1,
            tid: 1,
        };

        if (isNaN(cId)) {
            cId = ObjectID(cId);
        } else {
            cId = parseInt(cId);
        }

        var tenantString = "?";
        var clientVoteString = userEmail;

        var originalClientVoteString = clientVoteString;

        clientVoteString = cleanEmail(clientVoteString);
        var domain = getDomain(clientVoteString);

        if (clientVoteString.includes("undefined")) {
            clientVoteString = originalClientVoteString;
            tenantString = clientVoteString.split("@")[1].split(".")[0];
        }

        req.body.cleanEmail = clientVoteString;

        tenants.findOne({ domains: domain }, { projection: lightTenantProjection }, function (err, tenantDoc) {
            if (err) { throw err; }

            if (tenantDoc == null) {
                var realTenantId = "?";
                var tenantName = domain;
            } else {
                var realTenantId = tenantDoc.tid;
                var tenantName = tenantDoc.name;
            }

            var query = { "_id": cId };
            var updateOp = {};
            var updateOp2 = {};

            //console.log("upDown is " + upDown);
            //console.log("cId is " + cId);

            var voteObj = {
                email: clientVoteString,
                tenantId: realTenantId,
                tenantName: tenantName,
                //comment: comment,
                //client: client,
                //device: device,
                //teamsMode: teamsMode,
                //url: url,
                timestamp: new Date()
            }
            if (comment) {
                voteObj.comment = comment;
            }

            if (tap == "Windows") {
                voteObj.title = req.body.title;

                voteObj.windowsBuildType = req.body.windowsBuildType;
                voteObj.windowsBuildVersion = req.body.windowsBuildVersion;

                if ('public' in req.body) {
                    voteObj.public = req.body.public;
                }

                let valQuery = {};
                if (isNaN(req.body.validationId)) {
                    valQuery._id = ObjectID(req.body.validationId);
                } else {
                    valQuery._id = parseInt(req.body.validationId);
                }

                //console.log(valQuery);


                validations.findOne(valQuery, function (err, valDoc) {
                    if (err) { console.log(err); }
                    //console.log(valDoc);
                    if (valDoc) {
                        //console.log("Setting body.validation to a validation");
                        req.body.validation = valDoc;
                    }

                    createWindowsBug(req.body, function (workitemBody, attachmentBodies) {
                        console.log(workitemBody);
                        let id = workitemBody.id;
                        voteObj.id = id;
                        voteObj.publicId = new ObjectID();

                        if (attachmentBodies) {
                            let attachmentCount = attachmentBodies.length;
                            voteObj.attachmentCount = attachmentCount;
                        } else {
                            voteObj.attachmentCount = 0;
                        }

                        composeDataOps();
                    });
                });

            } else {
                composeDataOps();
            }

            function composeDataOps() {
               

                if (upDown == "up") {
                    // The pull op needs to just look for email address, in case the tenant name has changed in our database.
                    updateOp = { $pull: { "upvotes_v2": { "email": clientVoteString } } }
                    updateOp2 = {
                        $addToSet: { "upvotes_v2": voteObj },
                        $pull: { "downvotes_v2": { "email": clientVoteString, } }
                    };

                    specialFields.forEach(function (field) {
                        if (req.body[field]) {
                            updateOp['$pull']['upvotes_v2'][field] = req.body[field];
                            updateOp2['$pull']["downvotes_v2"][field] = req.body[field];

                            voteObj[field] = req.body[field];
                        }
                    })

                } else if (upDown == "down") {
                    updateOp = { $pull: { "downvotes_v2": { "email": clientVoteString } } }
                    updateOp2 = {
                        $addToSet: { "downvotes_v2": voteObj },
                        $pull: { "upvotes_v2": { "email": clientVoteString } }
                    };

                    specialFields.forEach(function (field) {
                        if (req.body[field]) {
                            updateOp['$pull']['downvotes_v2'][field] = req.body[field];
                            updateOp2['$pull']['upvotes_v2'][field] = req.body[field];

                            voteObj[field] = req.body[field];

                        }
                    })
                }

                executeDataOps();
            }

            function executeDataOps() {
                if (tap == "Windows") {
                    // For Windows, we don't want to replace the old vote. Just add the new vote (updateOp2)
                    delete updateOp2["$pull"];
                    cases.findOneAndUpdate(query, updateOp2, { returnOriginal: false }, function (err, result) {
                        console.log("Executed updateOp2 (the only one)");
                        addCaseToObject(err, result);
                    });
                } else {
                    // For all other TAPs, replace the user's old vote (using updateOp), then add the new vote (updateOp2)
                    cases.findOneAndUpdate(query, updateOp, { returnOriginal: false }, function (err, result) {
                        if (err) { console.log(err); }
                        console.log("Executed updateOp");
                        cases.findOneAndUpdate(query, updateOp2, { returnOriginal: false }, function (err2, result2) {
                            console.log("Executed updateOp2");
                            addCaseToObject(err2, result2);
                        });
                    })
                }
            }

            function addCaseToObject(err, result) {
                if (err) { throw err; }
                var kase = result.value;

                // newVoteDoc is the complete vote object, stored in the votes db.
                // It has more fields than the "voteObj" thing that got added to the case object.
                var newVoteDoc = {
                    id: voteObj.id,
                    upDown: upDown,
                    //comment: comment,
                    userTenantId: realTenantId,
                    userEmail: userEmail,
                    validationId: req.body.validationId,
                    caseId: cId,
                    //client: client,
                    //device: device,
                    //headset: headset,
                    //teamsMode: teamsMode,
                    tap: tap,
                    url: url,
                    public: votePublic,
                    timestamp: new Date(),
                }

                specialFields.forEach(function (field) {
                    if (req.body[field]) {
                        newVoteDoc[field] = req.body[field];
                    }
                })

                if (comment) {
                    newVoteDoc.comment = comment;
                }

                if (tap == "Teams") {
                    // Teams TAP has test cases in Azure DevOps that need updating
                    console.log("Going the Teams route");

                    votes.insertOne(newVoteDoc, function (err, voteDoc) {
                        if (err) { throw err; }
                        return writeVoteToADO(kase);
                    });

                } else if (tap == "Windows") {
                    // Windows TAP - doesn't have case workitems, but we should create a feedback workitem
                    console.log("Going the Windows TAP route");
                    newVoteDoc.comment = req.body.comment;

                    newVoteDoc.windowsBuildType = windowsBuildType;
                    newVoteDoc.windowsBuildVersion = windowsBuildVersion;

                    votes.insertOne(newVoteDoc, function (err, voteDoc) {
                        if (err) { throw err; }

                        return res.json(voteDoc.value);
                    });

                } else {
                    // Some other TAP
                    console.log("Some other tap has been selected");

                    votes.insertOne(newVoteDoc, function (err, voteDoc) {
                        if (err) { throw err; }
                        return res.json(voteDoc.value);
                    });

                }
            }

            function writeVoteToADO(kase) {
                var kaseDescription = "No description given";
                if (kase.description != null) {
                    kaseDescription = kase.description;
                }

                var voteList = "Scenario created by " + kase.submitter + " through the a TAP Validation Tab";
                voteList += "<br><br>" + kaseDescription;
                voteList += "<br><br><b>Works:</b><br>";
                if (kase.upvotes_v2.length > 0) {
                    // TODO: This is bad, need to only display important properties
                    voteList += "<table><thead><tr><td style='border: 1px solid black;'>Tenant</td><td style='border: 1px solid black;'>User</td><td style='border: 1px solid black;'>Client</td><td style='border: 1px solid black;'>Device</td><td>Headset</td></tr></thead><tbody>";
                    kase.upvotes_v2.forEach(function (upvote) {
                        voteList += "<tr><td style='border: 1px solid black;'>" + upvote.tenantName + "</td><td style='border: 1px solid black;'>" + upvote.email + "</td>";
                        if (upvote.client) {
                            voteList += "<td style='border: 1px solid black;'>" + upvote.client + "</td>";
                        } else {
                            "<td style='border: 1px solid black;'></td>";
                        }

                        if (upvote.device) {
                            voteList += "<td style='border: 1px solid black;'>" + upvote.device + "</td>";
                        } else {
                            "<td style='border: 1px solid black;'></td>";
                        }
                        if (upvote.headset) {
                            voteList += "<td style='border: 1px solid black;'>" + upvote.headset + "</td>";
                        } else {
                            "<td style='border: 1px solid black;'></td>";
                        }
                        voteList += "</tr>";
                    });
                    voteList += "</tbody></table><br><br>"
                }

                voteList += "<br><br><b>Fails:</b><br>";
                if (kase.downvotes_v2.length > 0) {
                    voteList += "<table><thead><tr><td style='border: 1px solid black;'>Tenant</td><td style='border: 1px solid black;'>User</td><td style='border: 1px solid black;'>Client</td><td style='border: 1px solid black;'>Device</td><td>Headset</td></tr></thead><tbody>";
                    kase.downvotes_v2.forEach(function (downvote) {
                        voteList += "<tr><td style='border: 1px solid black;'>" + downvote.tenantName + "</td><td style='border: 1px solid black;'>" + downvote.email + "</td>";
                        if (downvote.client) {
                            voteList += "<td style='border: 1px solid black;'>" + downvote.client + "</td>";
                        } else {
                            "<td style='border: 1px solid black;'></td>";
                        }
                        if (downvote.device) {
                            voteList += "<td style='border: 1px solid black;'>" + downvote.device + "</td>";
                        } else {
                            "<td style='border: 1px solid black;'></td>";
                        }
                        if (downvote.headset) {
                            voteList += "<td style='border: 1px solid black;'>" + downvote.headset + "</td>";
                        } else {
                            "<td style='border: 1px solid black;'></td>";
                        }
                        voteList += "</tr>";
                    });
                    voteList += "</tbody></table>";
                }


                var reqBody = [
                    {
                        op: "add",
                        path: "/fields/System.Description",
                        value: voteList
                    }
                ];

                var update_endpoint = TEAMS_ADO_WORKITEM_UPDATE_ENDPOINT.replace("{id}", cId);

                const options = {
                    url: update_endpoint,
                    headers: {
                        'Authorization': AUTH,
                        'Content-Type': 'application/json-patch+json'
                    },
                    body: JSON.stringify(reqBody)
                };

                request.patch(options, function (vstsErr, vstsResp, vstsBody) {
                    if (vstsErr) { console.log(vstsErr); }
                    //console.log("Vsts response was: " + vstsBody);

                    return res.status(200).send();
                });
            }
        });
    };

    function getStateAndReason(validationId, feedback, callback) {
        // Set the ADO fields for a given piece of feedback
        getAuthForCase(validationId, function (err, project) {
            if (err) { throw err; }
            let ado_endpoint = ADO_WORKITEM_GET_ENDPOINT
                .replace("{org}", project.org)
                .replace("{project}", project.project)
                .replace("{id}", feedback.id);

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
                    feedback.state = "New";
                    feedback.reason = "New";
                }

                if (!(feedback.title)) {
                    feedback.title = feedback.comment;
                }

                callback(feedback);
            });
        });
    }

    this.getCaseFeedbackByUser = function (req, res) {

        let votesChecked = 0;
        let votesTotal = 0;

        let feedback = [];
        function checkIfDone() {
            //console.log(votesChecked + " / " + votesTotal);
            if (votesChecked == votesTotal) {
                return res.json({ feedback: feedback });
            }
        }

        cases.findOne({ _id: ObjectID(req.body.caseId) }, function (err, caseDoc) {
            caseDoc.upvotes_v2.forEach(function (vote) {
                vote.type = "Works";
            });

            caseDoc.comments.forEach(function (vote) {
                vote.type = "Feedback";
            });

            caseDoc.downvotes_v2.forEach(function (vote) {
                vote.type = "Fails";
            });

            let currentUserComments = caseDoc.comments.filter(x => x.userEmail == req.body.userEmail);

            let allFeedback = caseDoc.upvotes_v2.concat(caseDoc.downvotes_v2).filter(x => x.email == req.body.userEmail).concat(currentUserComments);

            if (allFeedback.length == 0) {
                return res.json({ feedback: [] });
            }

            votesTotal = allFeedback.length;

            getAuthForCase(caseDoc.validationId, function (err, project) {

                allFeedback.forEach(function (vote) {
                    if (vote.id) {
                        getStateAndReason(caseDoc.validationId, vote, function (updatedCase) {
                            feedback.push(updatedCase);
                            votesChecked++;
                            checkIfDone();
                        });
                    } else {
                        // Placeholders for no ID
                        vote.id = "?";
                        vote.state = "New";
                        vote.reason = "New";

                        // Placeholder for no title (older feedback)
                        if (!vote.title) {
                            vote.title = vote.comment;
                        }

                        feedback.push(vote);
                        votesChecked++;
                        checkIfDone();
                    }

                    //if (vote.publicId) {
                    //    vote.id = vote.publicId;
                    //}
                });
                checkIfDone();
            });
        })
    }

    this.getCaseFeedbackPublic = function (req, res) {

        let votesChecked = 0;
        let votesTotal = 0;

        let feedback = [];
        function checkIfDone() {
            //console.log(votesChecked + " / " + votesTotal);
            if (votesChecked == votesTotal) {
                console.log(feedback);
                return res.json({ feedback: feedback });
            }
        }

        cases.findOne({ _id: ObjectID(req.body.caseId) }, function (err, caseDoc) {
            getAuthForCase(caseDoc.validationId, function (err, project) {

                caseDoc.upvotes_v2.forEach(function (vote) {
                    vote.type = "Works";
                });

                caseDoc.comments.forEach(function (vote) {
                    vote.type = "Feedback";
                });

                caseDoc.downvotes_v2.forEach(function (vote) {
                    vote.type = "Fails";
                });

                let nonCurrentUserComments, allFeedback;
                if (isMicrosoft(req.body.userEmail)) {
                    nonCurrentUserComments = caseDoc.comments.filter(x => x.userEmail != req.body.userEmail);

                    allFeedback = caseDoc.upvotes_v2.concat(caseDoc.downvotes_v2).filter(x => x.email != req.body.userEmail).concat(nonCurrentUserComments);
                } else {
                    // Can't just concat comments, as upvotes/downvotes use "email" field where comments use "userEmail"
                    nonCurrentUserComments = caseDoc.comments.filter(x => x.userEmail != req.body.userEmail).filter(x => x.public);

                    allFeedback = caseDoc.upvotes_v2.concat(caseDoc.downvotes_v2).filter(x => x.email != req.body.userEmail).filter(x => x.public).concat(nonCurrentUserComments);
                }

                //console.log(allFeedback);

                votesTotal = allFeedback.length;

                allFeedback.forEach(function (fb) {
                    // Remove unnecessary properties
                    delete fb.userTenantId;
                    //if (fb.comment) { delete fb.comment; }
                    //delete fb.comment;
                    //delete fb.attachmentCount;
                    delete fb.windowsBuildType;
                    delete fb.windowsBuildVersion;

                    if (!isMicrosoft(req.body.userEmail)) {
                        if (fb.userEmail) {
                            delete fb.userEmail;
                        }
                        if (fb.email) {
                            delete fb.email;
                        }

                        if (fb.id) { delete fb.id; }
                    } else {
                        fb.link = `https://dev.azure.com/${project.org}/${project.project}/_workitems/edit/${fb.id}`;
                        console.log(fb.link);
                    }


                    // Legacy feedback doesn't have titles
                    getStateAndReason(caseDoc.validationId, fb, function (updatedCase) {
                        if (fb.upvotes) {
                            fb.userUpvoted = fb.upvotes.includes(req.body.userEmail);
                        }
                        console.log(updatedCase);
                        feedback.push(updatedCase);

                        votesChecked++;
                        checkIfDone();
                    });
                });
                checkIfDone();
            });
        });
    }

    this.upvoteCaseFeedback = function (req, res) {

        let feedbackId = parseInt(req.params.id);

        let any_feedback_query = {
            $or: [
                { "upvotes_v2.id": feedbackId },
                { "downvotes_v2.id": feedbackId },
                { "comments.id": feedbackId },
            ]
        };

        let feedbackField;

        cases.findOne(any_feedback_query, function (err, caseDoc) {
            if (caseDoc) {
                cases.updateOne({ "upvotes_v2.id": feedbackId }, { $addToSet: { "upvotes_v2.$.upvotes": req.body.email } }, function (err, caseDoc1) {
                    if (caseDoc1.matchedCount) {
                        feedbackField = "upvotes_v2";
                    }
                    cases.updateOne({ "downvotes_v2.id": feedbackId }, { $addToSet: { "downvotes_v2.$.upvotes": req.body.email } }, function (err, caseDoc2) {
                        if (caseDoc2.matchedCount) {
                            feedbackField = "downvotes_v2";
                        }

                        cases.updateOne({ "comments.id": feedbackId }, { $addToSet: { "comments.$.upvotes": req.body.email } }, function (err, caseDoc3) {
                            if (caseDoc3.matchedCount) {
                                feedbackField = "comments";
                            }

                            // Update ADO item
                            let feedbackItem = caseDoc[feedbackField].find(x => x.id == feedbackId);
                            feedbackItem.upvotes.indexOf(req.body.email) === -1 ? feedbackItem.upvotes.push(req.body.email) : console.log("Already present");

                            let reproSteps = getWindowsReproSteps(feedbackItem);

                            // Post updates to ADO

                            var reqBody = [
                                {
                                    op: "add",
                                    path: "/fields/Microsoft.VSTS.TCM.ReproSteps",
                                    value: reproSteps
                                }
                            ];

                            getAuthForCase(caseDoc.validationId, function (err, project) {
                                var update_endpoint = ADO_WORKITEM_UPDATE_ENDPOINT
                                    .replace("{org}", project.org)
                                    .replace("{project}", project.project)
                                    .replace("{id}", feedbackId);

                                const options = {
                                    url: update_endpoint,
                                    headers: {
                                        'Authorization': project.auth,
                                        'Content-Type': 'application/json-patch+json'
                                    },
                                    body: JSON.stringify(reqBody)
                                };

                                request.patch(options, function (vstsErr, vstsResp, vstsBody) {
                                    console.log(vstsResp.statusCode);
                                    //console.log(vstsBody);

                                    return res.status(200).send();

                                });
                            });

                        });
                    });
                });
            } else {
                console.log("No case found with that feedback");
                return res.status(404).send();
            }

        });

    }

    this.commentOnCaseFeedback = function (req, res) {

        let feedbackId = parseInt(req.params.id);

        let any_feedback_query = {
            $or: [
                { "upvotes_v2.id": feedbackId },
                { "downvotes_v2.id": feedbackId },
                { "comments.id": feedbackId },
            ]
        };

        let commentObj = {
            email: req.body.email,
            comment: req.body.comment
        }

        let feedbackField;

        cases.findOne(any_feedback_query, function (err, caseDoc) {
            if (caseDoc) {
                cases.updateOne({ "upvotes_v2.id": feedbackId }, { $addToSet: { "upvotes_v2.$.comments": commentObj } }, function (err, caseDoc1) {
                    if (caseDoc1.matchedCount) {
                        console.log("It was an upvote")
                        feedbackField = "upvotes_v2";
                    }
                    cases.updateOne({ "downvotes_v2.id": feedbackId }, { $addToSet: { "upvotes_v2.$.comments": commentObj } }, function (err, caseDoc2) {
                        if (caseDoc2.matchedCount) {
                            console.log("It was a downvote");
                            feedbackField = "downvotes_v2";
                        }

                        cases.updateOne({ "comments.id": feedbackId }, { $addToSet: { "upvotes_v2.$.comments": commentObj } }, function (err, caseDoc3) {
                            if (caseDoc3.matchedCount) {
                                console.log("It was a comment")
                                feedbackField = "comments";
                            }

                            console.log("Recorded the upvote");

                            // Update ADO item
                            let feedbackItem = caseDoc[feedbackField].find(x => x.id == feedbackId);
                            console.log(feedbackItem);
                            if (feedbackItem.comments) {
                                feedbackItem.comments.push(commentObj);
                            } else {
                                feedbackItem.comments = [commentObj,];
                            }

                            // TEMP: Putting in test comments
                            /*
                            feedbackItem.comments = [
                                {
                                    "text": "Here's a test comment",
                                    "userEmail": "v-maxsil@microsoft.com"
                                },
                                {
                                    "text": "Here's another test comment",
                                    "userEmail": "v-maxsil@microsoft.com"
                                },
                            ];
                            */

                            console.log(feedbackItem);
                            let reproSteps = getWindowsReproSteps(feedbackItem);
                            console.log(reproSteps);

                            // Post updates to ADO

                            var reqBody = [
                                {
                                    op: "add",
                                    path: "/fields/Microsoft.VSTS.TCM.ReproSteps",
                                    value: reproSteps
                                }
                            ];

                            getAuthForCase(caseDoc.validationId, function (err, project) {
                                var update_endpoint = ADO_WORKITEM_UPDATE_ENDPOINT
                                    .replace("{org}", project.org)
                                    .replace("{project}", project.project)
                                    .replace("{id}", feedbackId);

                                const options = {
                                    url: update_endpoint,
                                    headers: {
                                        'Authorization': project.auth,
                                        'Content-Type': 'application/json-patch+json'
                                    },
                                    body: JSON.stringify(reqBody)
                                };

                                request.patch(options, function (vstsErr, vstsResp, vstsBody) {
                                    console.log(vstsResp.statusCode);
                                    console.log(vstsBody);

                                    return res.status(200).send();

                                });
                            });

                        });
                    });
                });
            } else {
                console.log("No case found with that feedback");
                return res.status(404).send();
            }

        });
    }

    this.modifyCaseFeedback = function (req, res) {
        console.log(req.body);

        let feedbackId = parseInt(req.params.id);

        let any_feedback_query = {
            $or: [
                { "upvotes_v2.id": feedbackId },
                { "downvotes_v2.id": feedbackId },
                { "comments.id": feedbackId },
            ]
        };

        let modifyUpvotesQuery = { $set: {} }
        let modifyDownvotesQuery = { $set: {} }
        let modifyCommentsQuery = { $set: {} }

        if (req.body.title) {
            console.log("Setting title");
            modifyUpvotesQuery["$set"]["upvotes_v2.$.title"] = req.body.title;
            modifyDownvotesQuery["$set"]["downvotes_v2.$.title"] = req.body.title;
            modifyCommentsQuery["$set"]["comments.$.title"] = req.body.title;
        }

        if (req.body.comment) {
            console.log("Setting comment");
            modifyUpvotesQuery["$set"]["upvotes_v2.$.comment"] = req.body.comment;
            modifyDownvotesQuery["$set"]["downvotes_v2.$.comment"] = req.body.comment;
            modifyCommentsQuery["$set"]["comments.$.comment"] = req.body.comment;
        }

        if (req.body.public != null) {
            console.log("Setting public");
            modifyUpvotesQuery["$set"]["upvotes_v2.$.public"] = req.body.public;
            modifyDownvotesQuery["$set"]["downvotes_v2.$.public"] = req.body.public;
            modifyCommentsQuery["$set"]["comments.$.public"] = req.body.public;
        }

        let feedbackDoc;
        let feedbackField;

        cases.findOne(any_feedback_query, function (err, caseDoc) {
            if (caseDoc) {
                cases.updateOne({ "upvotes_v2.id": feedbackId }, modifyUpvotesQuery, function (err, caseDoc1) {
                    if (caseDoc1.matchedCount) {
                        console.log(caseDoc1);
                        console.log("It was an upvote")
                        feedbackField = "upvotes_v2";
                    }
                    cases.updateOne({ "downvotes_v2.id": feedbackId }, modifyDownvotesQuery, function (err, caseDoc2) {
                        if (caseDoc2.matchedCount) {
                            console.log(caseDoc2);
                            console.log("It was a downvote")
                            feedbackField = "downvotes_v2";
                        }

                        cases.updateOne({ "comments.id": feedbackId }, modifyCommentsQuery, function (err, caseDoc3) {
                            if (caseDoc3.matchedCount) {
                                console.log(caseDoc3);
                                console.log("It was a comment")
                                feedback_fields = "comments";
                            }

                            console.log("Modified the feedback in DB");
                            console.log(feedbackField);

                            // Now, edit it in ADO

                            let feedbackItem = caseDoc[feedbackField].find(x => x.id == feedbackId);
                            console.log(feedbackItem);
                            if (req.body.title) {
                                feedbackItem.title = req.body.title;
                            }
                            if (req.body.comment) {
                                feedbackItem.comment = req.body.comment;
                            }
                            if (req.body.public) {
                                feedbackItem.public = req.body.public;
                            }

                            let reproSteps = getWindowsReproSteps(feedbackItem);

                            console.log(reproSteps);

                            var reqBody = [
                                {
                                    op: "add",
                                    path: "/fields/System.Title",
                                    value: feedbackItem.title,
                                },
                                {
                                    op: "add",
                                    path: "/fields/Microsoft.VSTS.TCM.ReproSteps",
                                    value: reproSteps
                                }
                            ];

                            getAuthForCase(caseDoc.validationId, function (err, project) {

                                var update_endpoint = ADO_WORKITEM_UPDATE_ENDPOINT
                                    .replace("{org}", project.org)
                                    .replace("{project}", project.project)
                                    .replace("{id}", feedbackId);

                                const options = {
                                    url: update_endpoint,
                                    headers: {
                                        'Authorization': project.auth,
                                        'Content-Type': 'application/json-patch+json'
                                    },
                                    body: JSON.stringify(reqBody)
                                };

                                request.patch(options, function (vstsErr, vstsResp, vstsBody) {
                                    console.log(vstsResp.statusCode);
                                    console.log(vstsBody);

                                    // Handle attachments
                                    if (req.body.attachments) {
                                        if (req.body.attachments.length > 0) {
                                            console.log("Handling attachments");
                                            uploadAttachments(req.body.attachments, feedbackId, project, function (attachmentBodies) {
                                                console.log(attachmentBodies);
                                                return res.status(200).send();
                                            });
                                        } else {
                                            return res.status(200).send();
                                        }
                                    } else {
                                        return res.status(200).send();
                                    }

                                    

                                });
                            })


                        });
                    });
                });
            } else {
                console.log("Feedback not found");
                return res.status(404).send();
            }
        });
    }
}

module.exports = caseHandler;