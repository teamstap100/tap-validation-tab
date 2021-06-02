'use strict';

var request = require('request');

const { ADO_API_BASE, safeOid } = require('../helpers/helpers.server');

const TEAMS_ADO_API_BASE = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/";

const TEAMS_ADO_WORKITEM_GET_ENDPOINT = TEAMS_ADO_API_BASE + "workitems/{id}?api-version=4.1";
const TEAMS_ADO_WORKITEM_UPDATE_ENDPOINT = TEAMS_ADO_API_BASE + "workitems/{id}?api-version=4.1";


function analyticsHandler (dbParent) {

    // "db.collection is not a function"
    var db = dbParent.db("clementine");
    var analytics = db.collection('analytics');
    var validations = db.collection('validations');

    const AUTH = process.env["TEAMS-ADO-PAT"];

    function updateSignOffTabLink(valDoc, callback) {
        // In the ADO workitem, set the sign-off tab to the first 
        if (valDoc.tabLocations == null) {
            return callback("No tab link found", {});
        }

        if (valDoc.tabLocations.length == 0) {
            return callback("No tab link found", {});
        }

        let firstLink = valDoc.tabLocations[0].tabUrl;
        if (firstLink == null) {
            return callback("No tab link found", {});
        }

        if (valDoc.validationWorkitemType != "TAP Validation") {
            return callback("No tab link found", {});
        }

        let ado_endpoint = TEAMS_ADO_WORKITEM_GET_ENDPOINT.replace("{id}", valDoc.validationWorkitemId);

        const options = {
            url: ado_endpoint,
            headers: {
                'Authorization': AUTH
            }
        };

        request.get(options, function (err, resp, body) {
            //console.log(body);
            body = JSON.parse(body);
            console.log(body.fields["Custom.SignOffTabLink"]);
            if (body.fields["Custom.SignOffTabLink"]) {
                console.log("Link already set");
                return callback(null, {});
            } else {
                let ado_signoff_update_params = [
                    {
                        "op": "add",
                        "path": "/fields/Custom.SignOffTabLink",
                        "value": firstLink,
                    }
                ];
                var ado_signoff_update_endpoint = TEAMS_ADO_WORKITEM_UPDATE_ENDPOINT.replace("{id}", valDoc.validationWorkitemId);

                const ado_signoff_update_options = {
                    url: ado_signoff_update_endpoint,
                    headers: {
                        'Authorization': AUTH,
                        'Content-Type': 'application/json-patch+json'
                    },
                    body: JSON.stringify(ado_signoff_update_params)
                };
                console.log(ado_signoff_update_options);

                request.patch(ado_signoff_update_options, function (adoErr, adoResp, adoBody) {
                    console.log(adoResp.statusCode);
                    console.log("Set tab link in ADO workitem");
                    return callback(null, {});
                });
            }
        });


    }

    this.updateValidationTabLocations = async function (req, res) {
        // Update the list of tab locations where this validation is happening.
        console.log(req.body);

        let valId = safeOid(req.body.validationId);

        let tabLocation = {
            teamId: req.body.teamId,
            teamName: req.body.teamName,
            channelId: req.body.channelId,
            channelName: req.body.channelName,
            tabUrl: req.body.tabUrl,
            timestamp: new Date(),
        };

        // TODO: Would it be better to check if it exists first? Might avoid unnecessary remove/insert operations

        // Pull any previous instances of this same team/channel
        validations.findOneAndUpdate({ _id: valId }, { $pull: { tabLocations: { channelId: tabLocation.channelId } } }, { new: true, multi: true }, function (err, updateDoc) {
            // Insert the new link
            validations.findOneAndUpdate({ _id: valId }, { $addToSet: { tabUrl: req.body.tabUrl, tabLocations: tabLocation } }, function (err, doc) {
                if (err) { throw err; }

                if (doc.value.tap == "Teams") {
                    updateSignOffTabLink(doc.value, function (err, results) {
                        if (err) { console.log(err); }
                        return res.status(200).send();

                    });
                } else {
                    return res.status(200).send();
                }

            });
        })
    }
}

module.exports = analyticsHandler;