'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');
var atob = require('atob');

function caseHandler(dbParent) {

    // "db.collection is not a function"
    var db = dbParent.db("clementine");
    var cases = db.collection('cases');
    var tenants = db.collection('tenants');
    var votes = db.collection('votes');

    const VSTS_API_BASE = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/";
    const VSTS_WORKITEM_UPDATE_ENDPOINT = VSTS_API_BASE + "workitems/{id}?api-version=4.1";
    // This auth is for the test azure devops
    //const AUTH = "Basic OmdnZjVvYmx1emNqdjd3dDQydDJ6b2cyeW9oazVveTV6MmFqYXBncGc3Z2xxeGZtYW1qdnE=";
    // This one's for production
    const AUTH = process.env.AUTH;

    // Testing with Luciano tenant
    const WINDOWS_AUTH = process.env.LUCIANO_AUTH;
    const WINDOWS_ADO_API_BASE = "https://dev.azure.com/lucianooo/TestProject/_apis/wit/";
    const WINDOWS_ADO_WORKITEM_ADD_ENDPOINT = WINDOWS_ADO_API_BASE + "workitems/$Bug?api-version=4.11";
    const WINDOWS_ADO_ATTACHMENT_CREATE_ENDPOINT = WINDOWS_ADO_API_BASE + "attachments";
    const WINDOWS_ADO_WORKITEM_UPDATE_ENDPOINT = WINDOWS_ADO_API_BASE + "workitems/{id}?api-version=4.1";

    function cleanEmail(email) {
        console.log("Cleaning email");
        console.log(email);
        email = email.toLowerCase();
        console.log(email);
        email = email.replace("#ext#@microsoft.onmicrosoft.com", "");
        console.log(email);
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

        console.log("Calling getCaseVotesByCustomer with body:");
        console.log(req.body);
        const email = req.body.email;
        var cId = req.body.cId;
        const upDown = req.body.upDown;

        var query = {};

        if (isNaN(cId)) {
            query._id = ObjectID(cId);
        } else {
            query._id = parseInt(cId);
        }
        
        console.log(query);
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


            }
        });

        function getVotes(tids, tenantName) {
            console.log(tids, tenantName);
            console.log(query);

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
                    if ((tids.includes(vote.tenantId)) || (tenantName == "Microsoft") || (vote.email == email)) {
                        let voteString = vote.email;
                        if (vote.client) {
                            voteString += " (" + vote.client + ")";
                        }

                        if ((vote.device && vote.teamsMode)) {
                            voteString += "(" + vote.device + " - " + vote.teamsMode + ")";
                        }

                        votes.push([voteString,]);
                    }
                })

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

        tenants.findOne({ domains: domain }, function (err, tenantDoc) {
            console.log("TenantDoc:", tenantDoc);
            if (err) { throw err; }

            if (tenantDoc == null) {
                var realTenantId = "?";
            } else {
                var realTenantId = tenantDoc.tid;
            }

            var commentDoc = {
                comment: comment,
                userEmail: clientVoteString,
                userTenantId: realTenantId,
                timestamp: Date.now()
            }

            cases.updateOne({ _id: cId }, { $push: { comments: commentDoc } }, function (err, result) {
                if (err) { throw err; }
                //console.log(result);

                if (tap == "Teams") {
                    //console.log("Now putting this in VSTS");
                    var reqBody = [
                        {
                            op: "add",
                            path: "/fields/System.History",
                            value: "'" + comment + "' - " + clientVoteString
                        }
                    ];

                    var update_endpoint = VSTS_WORKITEM_UPDATE_ENDPOINT.replace("{id}", cId);

                    const options = {
                        url: update_endpoint,
                        headers: {
                            'Authorization': AUTH,
                            'Content-Type': 'application/json-patch+json'
                        },
                        body: JSON.stringify(reqBody)
                    };

                    request.patch(options, function (vstsErr, vstsStatus, vstsResponse) {
                        if (vstsErr) { console.log(vstsErr); }
                        //console.log("Vsts response was: " + vstsResponse);
                        res.json(vstsResponse);
                    });
                } else if (tap == "Windows") {
                    // TODO
                    res.status(200).send();
                } else {
                    res.status(200).send();
                }


            });
        });
    };

    function createWindowsBug(body) {
        // Add the new bug to VSTS

        let bugTitle = "Fails - " + body.caseTitle;
        let tags = body.tag + ";" + "TAP; TAP-Bug";

        let systemInfo = "<strong>Build Type</strong>: " + body.windowsBuildType + "<br />";
        systemInfo += "<strong>Build Version</strong>: " + body.windowsBuildVersion + "<br />";

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
                "value": body.comment
            },
            {
                "op": "add",
                "path": "/fields/Microsoft.VSTS.TCM.SystemInfo",
                "value": systemInfo
            },
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
            if (vstsErr) { throw vstsErr; }
            console.log(vstsResponse);
            vstsResponse = JSON.parse(vstsResponse);

            let bugId = vstsResponse.id;

            if (body.attachmentContents) {
                console.log(body.attachmentContents);
                //let cleanContents = body.attachmentContents.split("base64,")[1];
                //cleanContents = atob(cleanContents);
                let cleanContents = body.attachmentContents;
                let attachment_endpoint = WINDOWS_ADO_ATTACHMENT_CREATE_ENDPOINT + "?fileName=" + body.attachmentName + "&api-version=5.1";

                let attachmentOptions = {
                    url: attachment_endpoint,
                    headers: {
                        'Authorization': WINDOWS_AUTH,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(cleanContents)
                }

                console.log(attachmentOptions);

                request.post(attachmentOptions, function (adoErr, adoStatus, adoResponse) {
                    if (adoErr) { throw adoErr; }

                    console.log(adoStatus);
                    console.log(adoResponse);

                    adoResponse = JSON.parse(adoResponse);
                    let attachmentUrl = adoResponse.url;

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

                    let linkOptions = {
                        url: WINDOWS_ADO_WORKITEM_UPDATE_ENDPOINT.replace('{id}', bugId),
                        headers: {
                            'Authorization': WINDOWS_AUTH,
                            'Content-TYpe': 'application/json-patch+json',
                        },
                        body: JSON.stringify(linkPatch),
                    }

                    console.log(linkOptions);

                    request.patch(linkOptions, function (adoErr, adoStatus, adoResponse) {
                        if (adoErr) { throw err; }

                        //console.log(adoStatus);
                        //console.log(adoResponse);

                        return;
                    });
                    
                })
            } else {
                return;
            }
        });
    }

    this.addVote = function (req, res) {
        console.log("addVote got called");

        console.log(req.body);

        //var refUrlParts = req.url.split('/');
        console.log("cid was " + req.body.cId);
        var cId = req.body.cId
        const userId = req.body.userId;
        const userEmail = req.body.userEmail;
        const clientType = req.body.clientType;
        const upDown = req.body.upDown;

        const client = req.body.client;
        const device = req.body.device;
        const teamsMode = req.body.teamsMode;

        const windowsBuildType = req.body.windowsBuildType;
        const windowsBuildVersion = req.body.windowsBuildVersion;

        const tap = req.body.tap;

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

        // TODO: Use projection here to get a more lightweight tenant
        tenants.findOne({ domains: domain }, function (err, tenantDoc) {
            //console.log("TenantDoc:", tenantDoc);
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
            console.log("upDown is " + upDown);
            console.log("cId is " + cId);

            var voteObj = {
                email: clientVoteString,
                tenantId: realTenantId,
                tenantName: tenantName,
                client: client,
                device: device,
                teamsMode: teamsMode,
                timestamp: new Date()
            }

            if (tap == "Windows") {
                voteObj.windowsBuildType = req.body.windowsBuildType;
                voteObj.windowsBuildVersion = req.body.windowsBuildVersion;
            }

            let specialFields = ['client', 'device', 'teamsMode', 'windowsBuildType', 'windowsBuildVersion'];


            if (upDown == "up") {
                // The pull op needs to just look for email address, incase the tenant name has changed in our database.
                updateOp = { $pull: { "upvotes_v2": { "email": clientVoteString } } }
                updateOp2 = {
                    $addToSet: { "upvotes_v2": voteObj },
                    $pull: { "downvotes_v2": { "email": clientVoteString, } }
                };

                specialFields.forEach(function (field) {
                    if (req.body[field]) {
                        updateOp['$pull']['upvotes_v2'][field] = req.body[field];
                        updateOp2['$pull']["downvotes_v2"][field] = req.body[field];
                    }
                })

                /*
                if (client) {
                    updateOp['$pull']['upvotes_v2'].client = client;
                    updateOp2['$pull']["downvotes_v2"].client = client;
                }
                if (device) {
                    updateOp['$pull']['upvotes_v2'].device = device;
                    updateOp2['$pull']["downvotes_v2"].device = device;
                }

                if (teamsMode) {
                    updateOp['$pull']['upvotes_v2'].teamsMode = teamsMode;
                    updateOp2['$pull']["downvotes_v2"].teamsMode = teamsMode;
                }

                if (windowsBuildType) {
                    updateOp['$pull']['upvotes_v2'].windowsBuildType = windowsBuildType;
                    updateOp2['$pull']["downvotes_v2"].windowsBuildType = windowsBuildType;
                }

                if (windowsBuildVersion) {
                    updateOp['$pull']['upvotes_v2'].windowsBuildVersion = windowsBuildVersion;
                    updateOp2['$pull']["downvotes_v2"].windowsBuildVersion = windowsBuildVersion;
                }
                */

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
                    }
                })

                /*
                if (client) {
                    updateOp['$pull']['downvotes_v2'].client = client;
                    updateOp2['$pull']["upvotes_v2"].client = client;
                }
                if (device) {
                    updateOp['$pull']['downvotes_v2'].device = device;
                    updateOp2['$pull']["upvotes_v2"].device = device;
                }

                if (teamsMode) {
                    updateOp['$pull']['downvotes_v2'].teamsMode = teamsMode;
                    updateOp2['$pull']["upvotes_v2"].teamsMode = teamsMode;
                }

                if (windowsBuildType) {
                    updateOp['$pull']['downvotes_v2'].windowsBuildType = windowsBuildType;
                    updateOp2['$pull']['upvotes_v2'].windowsBuildType = windowsBuildType;
                }

                if (windowsBuildVersion) {
                    updateOp['$pull']['downvotes_v2'].windowsBuildVersion = windowsBuildVersion;
                    updateOp2['$pull']['upvotes_v2'].windowsBuildVersion = windowsBuildVersion;
                }
                */
            }

            console.log(updateOp);
            console.log(updateOp2);
            cases.findOneAndUpdate(query, updateOp, { returnOriginal: false }, function (err, result) {
                if (err) { throw err; }
                cases.findOneAndUpdate(query, updateOp2, { returnOriginal: false }, function (err2, result) {
                    if (err2) { throw err2; }
                    var kase = result.value;

                    var newVoteDoc = {
                        upDown: upDown,
                        userTenantId: realTenantId,
                        userEmail: userEmail,
                        validationId: req.body.validationId,
                        caseId: cId,
                        client: client,
                        device: device,
                        teamsMode: teamsMode,
                        timestamp: new Date(),
                        tap: tap,
                    }

                    if (tap == "Teams") {
                        // Teams TAP has test cases in Azure DevOps that need updating
                        console.log("Going the Teams route");
                        var kaseDescription = "No description given";
                        if (kase.description != null) {
                            kaseDescription = kase.description;
                        }

                        var voteList = "Scenario created by " + kase.submitter + " through the a TAP Validation Tab";
                        voteList += "<br><br>" + kaseDescription;
                        voteList += "<br><br><b>Works:</b><br>";
                        if (kase.upvotes_v2.length > 0) {
                            voteList += "<table><thead><tr><td style='border: 1px solid black;'>Tenant</td><td style='border: 1px solid black;'>User</td><td style='border: 1px solid black;'>Client</td><td style='border: 1px solid black;'>Device</td></tr></thead><tbody>";
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
                                voteList += "</tr>";
                            });
                            voteList += "</tbody></table><br><br>"
                        }

                        voteList += "<br><br><b>Fails:</b><br>";
                        if (kase.downvotes_v2.length > 0) {
                            voteList += "<table><thead><tr><td style='border: 1px solid black;'>Tenant</td><td style='border: 1px solid black;'>User</td><td style='border: 1px solid black;'>Client</td><td style='border: 1px solid black;'>Device</td></tr></thead><tbody>";
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

                        var update_endpoint = VSTS_WORKITEM_UPDATE_ENDPOINT.replace("{id}", cId);

                        const options = {
                            url: update_endpoint,
                            headers: {
                                'Authorization': AUTH,
                                'Content-Type': 'application/json-patch+json'
                            },
                            body: JSON.stringify(reqBody)
                        };

                        request.patch(options, function (vstsErr, vstsStatus, vstsResponse) {
                            if (vstsErr) { console.log(vstsErr); }
                            //console.log("Vsts response was: " + vstsResponse);

                            votes.insertOne(newVoteDoc, function (err, voteDoc) {
                                if (err) { throw err; }

                                res.json(voteDoc.value);
                            });
                        });
                    } else if (tap == "Windows") {
                        // Windows TAP - doesn't have case workitems, but we should create a feedback workitem
                        console.log("Going the Windows TAP route");
                        newVoteDoc.comment = req.body.comment;

                        newVoteDoc.windowsBuildType = windowsBuildType;
                        newVoteDoc.windowsBuildVersion = windowsBuildVersion;

                        if (upDown == "down") {
                            createWindowsBug(req.body);
                        }

                        votes.insertOne(newVoteDoc, function (err, voteDoc) {
                            if (err) { throw err; }

                            res.json(voteDoc.value);
                        });
                    } else {
                        // Some other TAP
                        console.log("Some other tap has been selected");

                        votes.insertOne(newVoteDoc, function (err, voteDoc) {
                            if (err) { throw err; }
                            res.json(voteDoc.value);
                        });

                    }
                })
            });
        });
    };
}

module.exports = caseHandler;