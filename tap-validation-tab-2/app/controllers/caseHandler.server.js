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

    this.addVote = function (req, res) {
        console.log("addVote got called");

        console.log(req.body);

        //var refUrlParts = req.url.split('/');
        console.log("bid was " + req.body.cId);
        const cId = parseInt(req.body.cId);
        const userId = req.body.userId;
        const userTenantId = req.body.userTenantId;
        const userEmail = req.body.userEmail;
        const clientType = req.body.clientType;
        const upDown = req.body.upDown;

        var verboseUpDown = "Pass";
        if (upDown == "down") {
            verboseUpDown = "Fail";
        }

        var query = { "_id": cId };
        var updateOp;
        console.log("upDown is " + upDown);
        console.log("cId is " + cId);
        if (upDown == "up") {
            updateOp = { $addToSet: { "upvotes": userEmail }, $pull: { "downvotes": userEmail } }
        } else {
            updateOp = { $addToSet: { "downvotes": userEmail }, $pull: { "upvotes": userEmail } }
        }

        cases.findAndModify(
            query,
            {},
            updateOp,
            function (err, result) {
                if (err) { throw err; }

                var update_endpoint = VSTS_WORKITEM_UPDATE_ENDPOINT.replace("{id}", cId);

                const get_options = {
                    url: update_endpoint,
                    headers: {
                        'Authorization': AUTH
                    }
                };

                request.get(get_options, function (vstsErr, vstsStatus, vstsResponse) {
                    var vstsJson = JSON.parse(vstsResponse);
                    console.log(vstsJson);
                    var reproSteps = vstsJson["fields"]["Microsoft.VSTS.TCM.ReproSteps"];

                    tenants.findOne({ tid: userTenantId }, function (err, tenantDoc) {
                        if (err) { throw err; }
                        var tenantString = " (TID: " + userTenantId + "), ";
                        if (tenantDoc != null) {
                            tenantString = " (" + tenantDoc.name + "), ";
                        }
                        reproSteps += "<br />" + userEmail + tenantString + "on " + clientType + ", voted: " + verboseUpDown;

                        console.log(reproSteps);
                        var reqBody = [
                            {
                                op: "add",
                                path: "/fields/Microsoft.VSTS.TCM.ReproSteps",
                                value: reproSteps
                            }
                        ];

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
                                userTenantId: userTenantId,
                                userEmail: userEmail,
                                validationId: req.body.validationId,
                                timestamp: new Date(),
                            }

                            votes.insertOne(newVoteDoc, function (err, voteDoc) {
                                if (err) { throw err; }

                                res.json(result.value);
                            });


                        });
                        //res.json(result);
                    });
                    })

                    


            }
        );
    };
}

module.exports = caseHandler;