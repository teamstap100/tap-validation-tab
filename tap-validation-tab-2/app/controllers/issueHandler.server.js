'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');

function issueHandler (dbParent) {

    // "db.collection is not a function"
    var db = dbParent.db("clementine");
    var bugs = db.collection('bugs');
    var validations = db.collection('validations');
    var users = db.collection('users');

    const QUERY_BY_WIQL_ENDPOINT = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/wiql?api-version=5.0";


    var AUTH = process.env.AUTH;

    this.getIssue = function (req, res) {
        var issueWits = [];

        var validationObjs;

        var witsCount = 0;
        var witsDone = 0;

        var tags = req.params.validationIds;
        tags = tags.split("&");

        validations.find({}).toArray(function (err, vals) {
            validationObjs = vals;
            var body = {
                "query": "Select [System.Id] from WorkItems Where [System.State] = 'Active' and [System.WorkItemType] = 'Bug' and [System.Tags] contains 'TAPKnownIssues' and ("
            };
            tags.forEach(function (tag) {
                body.query += ' or ';
                body.query += "[System.Tags] contains '" + tag + "'";
            })

            body.query = body.query.replace("( or", '(');
            body.query += ")"

            console.log(body);

            var options = {
                url: QUERY_BY_WIQL_ENDPOINT,
                headers: {
                    'Authorization': AUTH,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            };

            request.post(options, function (vstsErr, vstsStatus, vstsResponse) {
                if (vstsErr) {
                    console.log(vstsErr);
                    throw vstsErr;
                }
                vstsResponse = JSON.parse(vstsResponse);
                var workitems = vstsResponse.workItems;
                witsCount = vstsResponse.workItems.length;

                workitems.forEach(function (wit) {

                    var witOptions = {
                        url: wit.url,
                        headers: {
                            'Authorization': AUTH,
                        }
                    }

                    request.get(witOptions, function (vstsErr, vstsStatus, vstsResponse) {
                        console.log(vstsResponse);

                        issueWits.push(JSON.parse(vstsResponse));
                        witsDone += 1;
                        checkIfDone();

                    })
                })

                // In case there are no workitems
                checkIfDone();
            });
        });

        function checkIfDone() {
            if (witsDone == witsCount) {
                finalRender();
            }
        }

        function finalRender() {
            console.log(issueWits);
            res.render('issue', {
                validations: validationObjs,
                issues: issueWits,
                tags: tags
            });
        }
    }

    this.getIssueConfig = function (req, res) {

        var alphaSort = { name: 1 };

        var activeNonBugValidations = {
            active: true,
            caseOrder: "normal"
        };

        validations.find(activeNonBugValidations).sort(alphaSort).toArray(function (err, valDocs) {
            res.render('issueConfig', {
                validations: valDocs
            });
        })
    };

  };

module.exports = issueHandler;