'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');

function issueHandler (dbParent) {

    // "db.collection is not a function"
    var db = dbParent.db("clementine");
    var validations = db.collection('validations');

    const QUERY_BY_WIQL_ENDPOINT = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/wiql?api-version=5.0";

    var AUTH = process.env.AUTH;

    function cleanBugTitle(title) {
        // Remove the client and submitter name from a bug title so it can be displayed.
        console.log(title);
        let workingTitle;
        if (title.split(":").length > 2) {
            workingTitle = title.split(":").slice(2).join(":");
            console.log(workingTitle);
        } else {
            workingTitle = title;
        }

        return workingTitle;
    }

    this.getIssues = function (req, res) {
        console.log("Called getIssues");
        var issueWits = [];

        var validationObjs;

        var witsCount = 0;
        var witsDone = 0;

        var tags = req.params.validationIds;
        tags = tags.split("&");

        console.log(tags);

        var body = {
            "query": "Select [System.Id] from WorkItems Where [System.State] <> 'Closed' and [System.Tags] contains 'TAPKnownIssues' and ("
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
            console.log(vstsStatus.statusCode);
            console.log(vstsResponse);
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
                    //console.log(vstsResponse);

                    let witObj = JSON.parse(vstsResponse);
                    let condensedWit = [
                        //witObj.id,
                        cleanBugTitle(witObj.fields["System.Title"])
                    ];

                    console.log(condensedWit);

                    issueWits.push(condensedWit);
                    witsDone += 1;
                    checkIfDone();

                })
            })

            // In case there are no workitems
            checkIfDone();
        });

        // TODO: There is probably no need to do this asynchronously with a checkIfDone(), since it's not in a validations call anymore
        function checkIfDone() {
            if (witsDone == witsCount) {
                return res.send({ issues: issueWits });
            }
        }
    }

    this.getIssueConfig = function (req, res) {

        var alphaSort = { name: 1 };

        var activeNonBugValidations = {
            active: true,
            caseOrder: "normal"
        };

        validations.find(activeNonBugValidations).sort(alphaSort).toArray(function (err, valDocs) {
            res.render('issues/issueConfig', {
                validations: valDocs
            });
        })
    };

  };

module.exports = issueHandler;