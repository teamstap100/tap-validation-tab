'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');

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
    var AUTH = process.env.AUTH;

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
            console.log(doc);
        })
    }

    // Add a comemnt to the case's workitem.
    this.addComment = function (req, res) {
        console.log("Called addComment");
        const cId = parseInt(req.body.cId);
        const comment = req.body.comment;
        const userEmail = req.body.userEmail;

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
                console.log(result);

                console.log("Now putting this in VSTS");
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
                    if (vstsErr) { throw vstsErr; }
                    console.log("Vsts response was: " + vstsResponse);
                    res.json(vstsResponse);
                });
            });
        });
    };

    this.addVote = function (req, res) {
        console.log("addVote got called");

        console.log(req.body);

        //var refUrlParts = req.url.split('/');
        console.log("cid was " + req.body.cId);
        const cId = parseInt(req.body.cId);
        const userId = req.body.userId;
        const userTenantId = req.body.userTenantId;
        const userEmail = req.body.userEmail;
        const clientType = req.body.clientType;
        const upDown = req.body.upDown;

        const client = req.body.client;
        const device = req.body.device;
        const teamsMode = req.body.teamsMode;

        var verboseUpDown = "Pass";
        if (upDown == "down") {
            verboseUpDown = "Fail";
        }

        var tenantString = "TID: " + userTenantId;
        var clientVoteString = userEmail;

        var originalClientVoteString = clientVoteString;

        clientVoteString = cleanEmail(clientVoteString);
        var domain = getDomain(clientVoteString);

        if (clientVoteString.includes("undefined")) {
            clientVoteString = originalClientVoteString;
            tenantString = clientVoteString.split("@")[1].split(".")[0];
        }

        console.log("clientVoteString is: " + clientVoteString + " tenantString is: " + tenantString + " domain is: " + domain);

        tenants.findOne({ domains: domain }, function (err, tenantDoc) {
            console.log("TenantDoc:", tenantDoc);
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


            if (upDown == "up") {
                // The pull op needs to just look for email address, incase the tenant name has changed in our database.
                updateOp = { $pull: { "upvotes_v2": { "email": clientVoteString } } }
                updateOp2 = {
                    $addToSet: { "upvotes_v2": voteObj },
                    $pull: { "downvotes_v2": { "email": clientVoteString, } }
                };
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

            } else if (upDown == "down") {
                updateOp = { $pull: { "downvotes_v2": { "email": clientVoteString } } }
                updateOp2 = {
                    $addToSet: { "downvotes_v2": voteObj },
                    $pull: { "upvotes_v2": { "email": clientVoteString } }
                };
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
            }

            console.log(updateOp);
            console.log(updateOp2);
            cases.findOneAndUpdate(query, updateOp, { returnOriginal: false }, function (err, result) {
                if (err) { throw err; }
                cases.findOneAndUpdate(query, updateOp2, { returnOriginal: false }, function (err2, result) {
                    if (err2) { throw err2; }
                    var kase = result.value;
                    console.log(kase, kase.upvotes, kase.downvotes);

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
                        if (vstsErr) { throw vstsErr; }
                        console.log("Vsts response was: " + vstsResponse);

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
                        }

                        votes.insertOne(newVoteDoc, function (err, voteDoc) {
                            if (err) { throw err; }

                            res.json(voteDoc.value);
                        });
                    });
                })
            });
        });
    };
}

module.exports = caseHandler;