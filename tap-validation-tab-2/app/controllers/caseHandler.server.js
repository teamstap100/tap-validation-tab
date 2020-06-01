'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');
var atob = require('atob');
const fs = require('fs');
const path = require('path');

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
    const WINDOWS_ADO_WORKITEM_ADD_ENDPOINT = WINDOWS_ADO_API_BASE + "workitems/${{WORKITEM_TYPE}}?api-version=4.11";
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
            } else {
                console.log("No tenant found, let's just go by email");
                //return res.status(400).send();
                getVotes([], "?");
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

                console.log(voteObjs);

                voteObjs.forEach(function (vote) {
                    if ((tids.includes(vote.tenantId)) || (tenantName == "Microsoft") || (vote.email == email)) {
                        let voteString = vote.email;
                        if (vote.client) {
                            voteString += " (" + vote.client + ")";
                        }

                        if ((vote.device && vote.teamsMode)) {
                            voteString += " (" + vote.device + " - " + vote.teamsMode + ")";
                        }

                        if (vote.windowsBuildVersion) {
                            voteString += " (" + vote.windowsBuildVersion + ")";
                        }

                        votes.push([voteString,]);
                    }
                })

                // Sort alphabetically
                votes.sort();

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
                    // TODO: Implement this
                    createWindowsBug(req.body);

                    res.status(200).send();

                } else {
                    res.status(200).send();
                }


            });
        });
    };

    function createWindowsBug(body) {
        // Add the new bug to VSTS

        let bugTitle = body.caseTitle;
        let tags = body.tag + ";" + "TAP; WCTAP";
        let workitemType = "Bug";

        if (body.upDown == "up") {
            bugTitle = "Works - " + bugTitle;
            tags += "; WCTAP-Works";

            // TODO: Pick a better workitem type for this
            workitemType = "Bug";

        } else if (body.upDown == "down") {
            bugTitle = "Fails - " + bugTitle;
            tags += "; WCTAP-Fails";
        } else if (body.upDown == "comment") {
            bugTitle = "Feedback - " + bugTitle;
            tags += "; WCTAP-Feedback";

            // TODO: Pick a better workitem for this
            workitemType = "Bug";
        }


        let systemInfo = "<strong>Build Type</strong>: " + body.windowsBuildType + "<br />";
        systemInfo += "<strong>Build Version</strong>: " + body.windowsBuildVersion + "<br />";
        systemInfo += "<strong>Submitter</strong>: " + body.userEmail + "<br />";

        var reqBody = [
            {
                "op": "add",
                "path": "/fields/System.Title",
                "value": bugTitle
            },
            // TODO: Use this in production, can't use it in my project
            //{
            //    "op": "add",
            //    "path": "/fields/System.AreaPath",
            //    "value": "OS\\Core\\EMX\\CXE\\Customer Connection\\TAP"
            //},
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

        let apiUrl = WINDOWS_ADO_WORKITEM_ADD_ENDPOINT.replace("{{WORKITEM_TYPE}}", workitemType);

        const options = {
            url: apiUrl,
            headers: {
                'Authorization': WINDOWS_AUTH,
                'Content-Type': 'application/json-patch+json'
            },
            body: JSON.stringify(reqBody)
        };

        console.log("Create workitem options:");
        console.log(options);

        request.post(options, function (vstsErr, vstsStatus, vstsResponse) {
            if (vstsErr) { throw vstsErr; }
            console.log("Create workitem response:");
            console.log(vstsResponse);
            vstsResponse = JSON.parse(vstsResponse);

            let bugId = vstsResponse.id;

            console.log(body.attachmentFilename);

            if (body.attachmentFilename) {
                // The attachment is given the filename in body.attachmentFilename. It is at uploads/body.attachmentFilename.

                let filePath = path.join(__dirname, '../../uploads', body.attachmentFilename);
                console.log(filePath);

                fs.readFile(filePath, (err, data) => {
                    if (err) throw err;
                    console.log(data);

                    let cleanContents = data;
                    //console.log(cleanContents);

                    let attachment_endpoint = WINDOWS_ADO_ATTACHMENT_CREATE_ENDPOINT + "?fileName=" + body.attachmentFilename + "&api-version=4.1";

                    let attachmentOptions = {
                        url: attachment_endpoint,
                        headers: {
                            'Authorization': WINDOWS_AUTH,
                            'Content-Type': 'application/octet-stream'
                        },
                        body: cleanContents,
                        encoding: null,
                    }

                    console.log(attachmentOptions);

                    request.post(attachmentOptions, function (adoErr, adoStatus, adoResponse) {
                        if (adoErr) { throw adoErr; }

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

                        request.patch(linkOptions, function (adoErr, adoStatus, adoResponse) {
                            if (adoErr) { throw err; }

                            return;
                        });

                    });
                });
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
        var cId = req.body.cId;
        const url = req.body.url;
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

        // TODO: Bug - when voting Works -> Fails in the same session, it creates two votes in Fails for some reason.

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
                client: client,
                device: device,
                teamsMode: teamsMode,
                url: url,
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
            }

            console.log("Update Op 1:");
            console.log(updateOp);
            cases.findOneAndUpdate(query, updateOp, { returnOriginal: false }, function (err, result) {
                if (err) { throw err; }
                console.log("Update Op 2:");
                console.log(updateOp2);
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
                        tap: tap,
                        url: url,
                        timestamp: new Date(),
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

                        // Bugs aren't just for downvotes anymore. Need signals for upvotes too
                        createWindowsBug(req.body);

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