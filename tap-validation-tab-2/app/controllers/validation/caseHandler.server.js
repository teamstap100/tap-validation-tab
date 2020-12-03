'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');
var atob = require('atob');
const fs = require('fs');
const path = require('path');
const { safeOid, patToAuth, ADO_API_BASE } = require('../../helpers/helpers.server');

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
    const ADO_ATTACHMENT_CREATE_ENDPOINT = ADO_API_BASE + "attachments?fileName={fileName}&api-version=4.1";
    const ADO_WORKITEM_UPDATE_ENDPOINT = ADO_API_BASE + "workitems/{id}?api-version=4.1";
    const ADO_WORKITEM_GET_ENDPOINT = ADO_API_BASE + "workitems/{id}?api-version=4.1";

    const TEAMS_ADO_API_BASE = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/";
    const TEAMS_ADO_WORKITEM_ADD_ENDPOINT = TEAMS_ADO_API_BASE + "workitems/$Bug?api-version=4.11";
    const TEAMS_ADO_WORKITEM_UPDATE_ENDPOINT = TEAMS_ADO_API_BASE + "workitems/{id}?api-version=4.1";

    // This one's for production
    const AUTH = process.env.AUTH;

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

    function getTenantString(email) {
        var domain = "?";
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
        return tenantString;
    }

    function base64ArrayBuffer(arrayBuffer) {
        var base64 = ''
        var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

        var bytes = new Uint8Array(arrayBuffer)
        var byteLength = bytes.byteLength
        var byteRemainder = byteLength % 3
        var mainLength = byteLength - byteRemainder

        var a, b, c, d
        var chunk

        // Main loop deals with bytes in chunks of 3
        for (var i = 0; i < mainLength; i = i + 3) {
            // Combine the three bytes into a single integer
            chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

            // Use bitmasks to extract 6-bit segments from the triplet
            a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
            b = (chunk & 258048) >> 12 // 258048   = (2^6 - 1) << 12
            c = (chunk & 4032) >> 6 // 4032     = (2^6 - 1) << 6
            d = chunk & 63               // 63       = 2^6 - 1

            // Convert the raw binary segments to the appropriate ASCII encoding
            base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
        }

        // Deal with the remaining bytes and padding
        if (byteRemainder == 1) {
            chunk = bytes[mainLength]

            a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

            // Set the 4 least significant bits to zero
            b = (chunk & 3) << 4 // 3   = 2^2 - 1

            base64 += encodings[a] + encodings[b] + '=='
        } else if (byteRemainder == 2) {
            chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

            a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
            b = (chunk & 1008) >> 4 // 1008  = (2^6 - 1) << 4

            // Set the 2 least significant bits to zero
            c = (chunk & 15) << 2 // 15    = 2^4 - 1

            base64 += encodings[a] + encodings[b] + encodings[c] + '='
        }

        return base64
    }

    function getWindowsReproSteps(body) {
        let tableStyle = "border: solid black 1px; padding: 4px 4px 4px 4px;";


        // Take a bug and create Windows repro steps for it.
        let reproSteps = `<table style='${tableStyle}'><thead style='${tableStyle}'><tr style='${tableStyle}'><td style='${tableStyle}'>Key</td><td style='${tableStyle}'>Value</td></thead><tbody>`;

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


        reproSteps += `<tr style='${tableStyle}'> <td style='${tableStyle}'> Submitter </td> <td style='${tableStyle}'>${userEmail} </td></tr>`;

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
                commentsTable += `<tr style='${tableStyle}'> <td style='${tableStyle}'> "${comment.text}" - ${comment.userEmail}</td></tr>`
            });
        }
        commentsTable += "</tbody></table>";

        reproSteps += `<tr style='${tableStyle}'> <td style='${tableStyle}'> Comments </td> <td style='${tableStyle}'>${commentsTable} </td></tr>`;


        /*
        let systemInfo = "<br /><br />";
        if (body.windowsBuildType) {
            systemInfo += "<strong>Build Type</strong>: " + body.windowsBuildType + "<br />";
        }
        if (body.windowsBuildVersion) {
            systemInfo += "<strong>Build Version</strong>: " + body.windowsBuildVersion + "<br />";
        }

        let userEmail;
        if (body.email) {
            userEmail = body.email;
        } else if (body.userEmail) {
            userEmail = body.userEmail;
        } else if (body.submitterEmail) {
            userEmail = body.submitterEmail;
        }

        systemInfo += "<strong>Submitter</strong>: " + cleanEmail(userEmail) + " (" + userEmail + ")<br />";

        let safeComment = body.comment.replace(/\r?\n/g, '<br />');

        let reproSteps = safeComment + systemInfo;

        */

        reproSteps += "</tbody></table>";

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
        const email = req.body.email;
        var cId = req.body.cId;
        const upDown = req.body.upDown;

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
                            console.log(vote);
                            //console.log(vote.email, email);
                            // TODO: Currently the client logic checks for this user's email in the string when deciding what to do with buttons and such.
                            // It'd be better to include a boolean for "it's this user" and do that stuff in the ajaxRefresh function.
                            // For now we are includiing the user's email in the string to keep this funcitonality.
                            //if (vote.email == email) {
                            //    voteString = '"' + vote.comment + '" - ' + vote.email;
                            //} else {
                            //    voteString = '"' + vote.comment + '"';
                            // }
                            if (vote.id) {
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
        const comment = req.body.comment;
        const userEmail = req.body.userEmail;

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
                timestamp: Date.now()
            }

            specialFields.forEach(function (field) {
                if (req.body[field]) {
                    commentDoc[field] = req.body[field];
                }
            });

            console.log(commentDoc);

            

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

                console.log(valQuery);

                validations.findOne(valQuery, function (err, valDoc) {
                    if (valDoc) {
                        req.body.validation = valDoc;

                        createWindowsBug(req.body, function (workitemBody, attachmentBody) {
                            console.log(workitemBody);

                            console.log("Setting id: " + workitemBody.id);
                            commentDoc.id = workitemBody.id;

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

    function uploadAttachments(files, bugId, project, callback) {
        console.log("Called uploadAttachments");
        console.log(files);

        var attachmentBodies = [];

        function uploadAndLink(fileIndex, files) {
            console.log("Called uploadAndLink on", fileIndex);
            let file = files[fileIndex];
            //console.log(file);
            let filename = file.filename;
            let filePath = path.join(process.cwd(), "uploads", filename);
            console.log(filePath);

            fs.readFile(filePath, (err, data) => {
                if (err) throw err;
                //console.log(data);

                let cleanContents = data;
                //console.log(cleanContents);

                let attachment_endpoint = ADO_ATTACHMENT_CREATE_ENDPOINT
                    .replace("{org}", project.org)
                    .replace("{project}", project.project)
                    .replace("{fileName}", filename);

                let attachmentOptions = {
                    url: attachment_endpoint,
                    headers: {
                        'Authorization': project.auth,
                        'Content-Type': 'application/octet-stream'
                    },
                    body: cleanContents,
                    encoding: null,
                }

                console.log(attachmentOptions);

                request.post(attachmentOptions, function (adoErr, adoResp, adoBody) {
                    if (adoErr) { throw adoErr; }

                    console.log(adoBody);

                    adoBody = JSON.parse(adoBody);
                    let attachmentUrl = adoBody.url;

                    let linkPatch = [
                        {
                            "op": "add",
                            "path": "/relations/-",
                            "value": {
                                "rel": "AttachedFile",
                                "url": attachmentUrl,
                                "attributes": {
                                    "comment": ""
                                }
                            },
                        }
                    ];

                    let updateEndpoint = ADO_WORKITEM_UPDATE_ENDPOINT
                        .replace("{org}", project.org)
                        .replace("{project}", project.project)
                        .replace('{id}', bugId);

                    let linkOptions = {
                        url: updateEndpoint,
                        headers: {
                            'Authorization': project.auth,
                            'Content-Type': 'application/json-patch+json',
                        },
                        body: JSON.stringify(linkPatch),
                    }

                    request.patch(linkOptions, function (attachmentErr, attachmentResp, attachmentBody) {
                        if (attachmentErr) { throw attachmentErr; }

                        console.log(attachmentResp.statusCode);
                        console.log(attachmentBody);

                        attachmentBodies.push(attachmentBody);
                        console.log("File done uploading");

                        fileIndex++;
                        if (files.length > fileIndex) {
                            return uploadAndLink(fileIndex, files);
                        } else {
                            return callback(attachmentBodies);
                        }
                    });
                });
            });
        }

        uploadAndLink(0, files);
    }

    function createWindowsBug(body, callback) {
        // Add the new bug to VSTS

        console.log(body);

        let bugTitle = body.caseTitle;
        let tags = body.tag + ";" + "WCCP;" + body.caseTitle;

        // TODO: This is just Bug all the time
        let workitemType = "Bug";

        if (body.upDown == "up") {
            //bugTitle = "Works - " + bugTitle;
            bugTitle = "";
            tags += "; WCCP-Works";

            // TODO: Pick a better workitem type for this
            workitemType = "Bug";

        } else if (body.upDown == "down") {
            //bugTitle = "Fails - " + bugTitle;
            bugTitle = "";
            tags += "; WCCP-Fails";
        } else if (body.upDown == "comment") {
           // bugTitle = "Feedback - " + bugTitle;
            bugTitle = "";
            tags += "; WCCP-Feedback";

            workitemType = "Bug";
        }

        let safeComment = body.comment.replace(/\r?\n/g, '<br />');
        bugTitle = safeComment;

        if (bugTitle.length > 200) {
            bugTitle = bugTitle.slice(0, 197) + "...";
        }

        let reproSteps = getWindowsReproSteps(body);

        var reqBody = [
            {
                "op": "add",
                "path": "/fields/System.Title",
                "value": body.title
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
            if (body.validation.areaPath.length > 0) {
                // Validation-specific area path
                reqBody.push({
                    "op": "add",
                    "path": "/fields/System.AreaPath",
                    "value": body.validation.areaPath
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
                // This area path only works in production

                if (body.cleanEmail) {
                    reqBody.push({
                        "op": "add",
                        "path": "/fields/OSG.Partner.PartnerPOC",
                        "value": body.cleanEmail
                    });
                }

                reqBody.push({
                    "op": "add",
                    "path": "/fields/Microsoft.VSTS.Common.Release",
                    "value": "Cobalt"
                });

                // TODO: This is not ready yet, as it requires another field to be set
                //reqBody.push({
                //    "op": "add",
                //    "path": "/fields/OSG.Partner.PartnerProgram",
                //    "value": "Windows 10 TAP"
                //})
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

            console.log("Create workitem options:");
            console.log(options);

            request.post(options, function (vstsErr, vstsResp, vstsBody) {
                if (vstsErr) { throw vstsErr; }

                console.log(vstsResp.statusCode);

                vstsBody = JSON.parse(vstsBody);
                console.log(vstsBody);

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
        //console.log("addVote got called");

        //console.log(req.body);

        //var refUrlParts = req.url.split('/');
        //console.log("cid was " + req.body.cId);
        var cId = req.body.cId;
        const url = req.body.url;
        const userId = req.body.userId;
        const userEmail = req.body.userEmail;
        const clientType = req.body.clientType;
        const upDown = req.body.upDown;

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

        var verboseUpDown = "Pass";
        if (upDown == "down") {
            verboseUpDown = "Fail";
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

        console.log("clientVoteString is: " + clientVoteString + " tenantString is: " + tenantString + " domain is: " + domain);

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
                comment: comment,
                //client: client,
                //device: device,
                //teamsMode: teamsMode,
                url: url,
                timestamp: new Date()
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
                        //console.log(workitemBody);
                        let id = workitemBody.id;
                        voteObj.id = id;

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
                let specialFields = ['client', 'device', 'headset', 'networkScenarios', 'teamsMode', 'windowsBuildType', 'windowsBuildVersion'];

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

                addToCaseObject();
            }

            function addToCaseObject() {
                //console.log("Update Op 1:");
                //console.log(updateOp);

                let opsDone = 0;
                var ops = [];

                if (tap == "Windows") {
                    // For Windows, we don't want to replace the old vote. 
                    delete updateOp2["$pull"];
                    ops = [updateOp2];
                } else {
                    ops = [updateOp, updateOp2];
                }

                //console.log(ops);

                ops.forEach(function (op) {
                    cases.findOneAndUpdate(query, op, { returnOriginal: false }, function (err, result) {
                        opsDone++;
                        console.log(opsDone + " / " + ops.length);
                        if (opsDone == ops.length) {
                            if (err) { throw err; }
                            var kase = result.value;

                            // newVoteDoc is the complete vote object, stored in the votes db.
                            // It has more fields than the "voteObj" thing that got added to the case object.
                            var newVoteDoc = {
                                id: voteObj.id,
                                upDown: upDown,
                                comment: comment,
                                userTenantId: realTenantId,
                                userEmail: userEmail,
                                validationId: req.body.validationId,
                                caseId: cId,
                                client: client,
                                device: device,
                                headset: headset,
                                teamsMode: teamsMode,
                                tap: tap,
                                url: url,
                                public: votePublic,
                                timestamp: new Date(),
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
                    });
                });
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

    this.getCaseFeedbackByUser = function(req, res) {
        //console.log(req.body);

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
            //console.log(caseDoc);

            caseDoc.upvotes_v2.forEach(function (vote) {
                vote.type = "Works";
            });

            caseDoc.comments.forEach(function (vote) {
                vote.type = "Feedback";
            });

            caseDoc.downvotes_v2.forEach(function (vote) {
                vote.type = "Fails";
            });
            let allFeedback = caseDoc.upvotes_v2.concat(caseDoc.downvotes_v2).concat(caseDoc.comments).filter(x => x.email == req.body.userEmail);
            //console.log(allFeedback);

            votesTotal = allFeedback.length;

            getAuthForCase(caseDoc.validationId, function (err, project) {

                allFeedback.forEach(function (vote) {
                    if (vote.id) {
                        let ado_endpoint = ADO_WORKITEM_GET_ENDPOINT
                            .replace("{org}", project.org)
                            .replace("{project}", project.project)
                            .replace("{id}", vote.id);

                        const options = {
                            url: ado_endpoint,
                            headers: {
                                'Authorization': project.auth
                            }
                        };
                        request.get(options, function (err, resp, body) {
                            try {
                                body = JSON.parse(body);
                                //console.log(body.fields["System.State"]);
                                //console.log(body.fields["System.Reason"]);

                                vote.state = body.fields["System.State"];
                                vote.reason = body.fields["System.Reason"];
                            } catch (e) {
                                console.log(e);
                                console.log("Falling back on default");
                                vote.state = "New";
                                vote.reason = "New";
                            }

                            // Placeholder for no title (older feedback)

                            if (!vote.title) {
                                vote.title = vote.comment;
                            }

                            feedback.push(vote);
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
                });
            });
        })
    }

    this.getCaseFeedbackPublic = function (req, res) {
        console.log(req.body);

        cases.findOne({ _id: ObjectID(req.body.caseId) }, function (err, caseDoc) {
            console.log(caseDoc);
            let allFeedback = caseDoc.upvotes_v2.concat(caseDoc.downvotes_v2).concat(caseDoc.comments).filter(x => x.email != req.body.userEmail).filter(x => x.public);
            console.log(allFeedback);

            console.log(allFeedback);

            allFeedback.forEach(function (fb) {
                // Legacy feedback doesn't have titles
                if (!fb.title) {
                    fb.title = fb.comment;
                }

                if (fb.upvotes) {
                    fb.userUpvoted = fb.upvotes.includes(req.body.userEmail);
                }

            })

            return res.json({ feedback: allFeedback });
        });
    }

    this.upvoteCaseFeedback = function (req, res) {
        console.log(req.body);
        console.log(req.params.id);

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
                        console.log("It was an upvote")
                        feedbackField = "upvotes_v2";
                    }
                    cases.updateOne({ "downvotes_v2.id": feedbackId }, { $addToSet: { "downvotes_v2.$.upvotes": req.body.email } }, function (err, caseDoc2) {
                        if (caseDoc2.matchedCount) {
                            console.log("It was a downvote");
                            feedbackField = "downvotes_v2";
                        }

                        cases.updateOne({ "comments.id": feedbackId }, { $addToSet: { "comments.$.upvotes": req.body.email } }, function (err, caseDoc3) {
                            if (caseDoc3.matchedCount) {
                                console.log("It was a comment")
                                feedbackField = "comments";
                            }

                            console.log("Recorded the upvote");

                            // Update ADO item
                            let feedbackItem = caseDoc[feedbackField].find(x => x.id == feedbackId);
                            console.log(feedbackItem);
                            feedbackItem.upvotes.indexOf(req.body.email) === -1 ? feedbackItem.upvotes.push(req.body.email) : console.log("Already present");

                            // TEMP: Putting in test comments
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

    this.commentOnCaseFeedback = function (req, res) {
        console.log(req.body);
        console.log("Not yet implemented");
        return res.status(200).send();
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

        let modifyUpvotesQuery = {
            $set: {
                "upvotes_v2.$.title": req.body.title,
                "upvotes_v2.$.comment": req.body.comment,
                "upvotes_v2.$.public": req.body.public,
            }
        }

        let modifyDownvotesQuery = {
            $set: {
                "downvotes_v2.$.title": req.body.title,
                "downvotes_v2.$.comment": req.body.comment,
                "downvotes_v2.$.public": req.body.public,
            }
        }

        let modifyCommentsQuery = {
            $set: {
                "comments.$.title": req.body.title,
                "comments.$.comment": req.body.comment,
                "comments.$.public": req.body.public,
            }
        }

        console.log(any_feedback_query);

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
                            feedbackItem.title = req.body.title;
                            feedbackItem.comment = req.body.comment;
                            feedbackItem.public = req.body.public;

                            let reproSteps = getWindowsReproSteps(feedbackItem);

                            console.log(reproSteps);

                            var reqBody = [
                                {
                                    op: "add",
                                    path: "/fields/System.Title",
                                    value: req.body.title
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
                                        console.log("Handling attachments");
                                        uploadAttachments(req.body.attachments, feedbackId, project, function (attachmentBodies) {
                                            console.log(attachmentBodies);
                                            return res.status(200).send();
                                        });
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