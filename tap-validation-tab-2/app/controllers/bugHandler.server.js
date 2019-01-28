'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');

function bugHandler (dbParent) {

  // "db.collection is not a function"
  var db = dbParent.db("clementine");
  var bugs = db.collection('bugs');
    var validations = db.collection('validations');
    var users = db.collection('users');

  // db used to return the db, now it returns the parent in mongo 3.0.0.
  // So, need to point it to the real db each time.

  //const VSTS_API_BASE = "https://dev.azure.com/lucianooo/TestProject/_apis/wit/";
    const VSTS_API_BASE = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/";
  const VSTS_BUGS_ENDPOINT = VSTS_API_BASE + "workitems/$bug?api-version=4.1";
  const VSTS_WORKITEM_UPDATE_ENDPOINT = VSTS_API_BASE + "workitems/{id}?api-version=4.1";
    // This auth is for the test azure devops
    //const AUTH = "Basic OmdnZjVvYmx1emNqdjd3dDQydDJ6b2cyeW9oazVveTV6MmFqYXBncGc3Z2xxeGZtYW1qdnE=";
    // This one's for production
    var AUTH = process.env.AUTH;


  // Get all the bugs with a given vId
  // (This doesn't appear to be used?)
  this.getBug = function(req, res) {
    console.log("Calling getBug");
    console.log(req.params.vId);
    var bugProjection = {}
    var query = ObjectID(req.params.vId);
    //console.log(query);
    bugs.findOne(query, bugProjection, function(err, doc) {
      if (err) {
        throw err;
      }

      //res.json(doc);
      //console.log(doc);
      res.render('bug', {
        name: doc.name,
        upvotes: doc.upvotes,
        downvotes: doc.downvotes
      });
    });
  };

  this.getOneBug = function(req, res) {
    var refUrlParts = req.url.split('/');
    const bId = parseInt(refUrlParts.pop());

      // bug IDs are just ints, not OIDs
      var query = { "_id": bId };
    bugs.findOne(query, {}, function(err, doc) {
      if (err) { throw err; }

      res.json(doc);
      console.log(doc);
    })
  }

  this.addBug = function(req, res) {
    console.log("addbug got called");
    //console.log(req.body);
    //console.log(req.headers.referer.split('/'))

    //console.log(req);

    //var refUrlParts = req.headers.referer.split('/')
    //var validationId = refUrlParts.pop();
    var validationId = req.body.validationId;
      var bugSubmitter = req.body.submitter;
      var submitterTenantId = req.body.submitterTenantId;

      console.log("bugSubmitter is " + bugSubmitter);

      console.log("Creating new bug with validaitonId " + validationId);

    validations.findOne(ObjectID(validationId), {}, function(err, valDoc) {
      if (err) { throw err; }

      var newBug = {
        name: req.body.bugDescription,
        validationId: ObjectID(validationId),
        validationTag: valDoc.tag,
        submitter: bugSubmitter,
        submitterTenantId: submitterTenantId,
        vstsState: "New",
        clientType: req.body.clientType,
        upvotes: [bugSubmitter,],
        downvotes: [],
          timestamp: new Date(),
        };

        var validationName = valDoc["name"];

      
        if (req.body.hasOwnProperty("vstsId")) {
            console.log("vstsId was detected in the request");
            newBug._id = req.body.vstsId;
        } else {
            console.log("No vstsId in that request");
        }

        if (req.body.hasOwnProperty("vstsState")) {
            newBug.vstsState = req.body.vststState;
        }

        // Set the timestamp if it's there. Useful for importing older bugs
        if (req.body.hasOwnProperty("timestamp")) {
            newBug.timestamp = req.body.timestamp;
        }

        // TODO: Code smellz
        if (newBug.hasOwnProperty("_id")) {
            bugs.insertOne(newBug, function (err, doc) {
                console.log("Calling insertOne");
                if (err) {
                    throw err;
                }

                console.log("New bug created:" + JSON.stringify(doc.ops[0]));

                res.json(doc.ops[0]);
            });
        } else {
            var bugProjection = {};

            console.log("No vstsId, so adding this to vsts");

            // Add the new bug to VSTS
            var reqBody = [
                {
                    "op": "add",
                    "path": "/fields/System.Title",
                    "value": newBug.name
                },
                {
                    "op": "add",
                    "path": "/fields/System.AreaPath",
                    "value": "MSTeams\\Customer Feedback"
                },
                {
                    "op": "add",
                    "path": "/fields/Microsoft.VSTS.TCM.SystemInfo",
                    "value": "Submitted by " + bugSubmitter + " through the TAP Validation Tab for '" + validationName + "'"
                },
                {
                    "op": "add",
                    "path": "/fields/MicrosoftTeamsCMMI.CustomerName",
                    "value": submitterTenantId
                },
                {
                    "op": "add",
                    "path": "/fields/MicrosoftTeamsCMMI.CustomerEmail",
                    "value": bugSubmitter
                },
                // TODO: Add other ops here
            ];
            const options = {
                url: VSTS_BUGS_ENDPOINT,
                headers: {
                    'Authorization': AUTH,
                    'Content-Type': 'application/json-patch+json'
                },
                body: JSON.stringify(reqBody)
            };

            request.post(options, function (vstsErr, vstsStatus, vstsResponse) {
                if (vstsErr) { throw vstsErr; }
                var vstsJson = JSON.parse(vstsResponse);
                console.log(vstsStatus);
                console.log(vstsResponse);
                console.log(vstsJson);
                const vstsId = parseInt(vstsJson.id);
                console.log("the vstsID is", vstsId);
                newBug._id = vstsId;
                // TODO: What to do if something is submitted with the same VSTSID?
                bugs.insertOne(newBug, function (err, doc) {
                    console.log("Calling insertOne");
                    if (err) {
                        throw err;
                    }

                    console.log("New bug created:" + JSON.stringify(doc.ops[0]));

                    res.json(doc.ops[0]);
                });
            });
        }
      })
  };

  this.addVote = function(req, res) {
    console.log("addVote got called");

    console.log(req.body);

    //var refUrlParts = req.url.split('/');
      console.log("bid was " + req.body.bId);
      const bId = parseInt(req.body.bId);
    const userId = req.body.userId;
      const userEmail = req.body.userEmail;
      const userTenantId = req.body.userTenantId;
    const clientType = req.body.clientType;
    const upDown = req.body.upDown;
    var verboseUpDown = "I can repro";
    if (upDown == "down") {
      verboseUpDown = "Cannot repro";
    }

      var query = { "_id": bId };
    var updateOp;
    console.log("upDown is " + upDown);
    console.log("bId is " + bId);
    if (upDown == "up") {
      updateOp = { $addToSet: { "upvotes": userEmail}, $pull: { "downvotes": userEmail} }
    } else {
      updateOp = { $addToSet: { "downvotes": userEmail }, $pull: { "upvotes": userEmail} }
    }

      bugs.findAndModify(
          query,
          {},
          updateOp,
          function (err, result) {
              if (err) { throw err; }

              console.log(result);
              console.log(result[0]);
              // Now put the vote in VSTS
              var reqBody = [
                  {
                      op: "add",
                      path: "/fields/System.History",
                      value: userEmail + " (on " + clientType + ") voted: " + verboseUpDown
                  }
              ];

              var update_endpoint = VSTS_WORKITEM_UPDATE_ENDPOINT.replace("{id}", bId);
              //console.log(update_endpoint);
              //console.log(result.value._id);
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
                  //console.log("Vsts response was: " + vstsResponse);
                  res.json(result.value);
              });
          });

      var userQuery = { "email": userEmail };
      var userData = {
          "email": userEmail,
          "tenantId": userTenantId,
      };

      users.update(userQuery, userData, {
          upsert: true
      }
      );



  };
}

module.exports = bugHandler;