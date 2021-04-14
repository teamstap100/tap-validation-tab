'use strict';

const fs = require('fs');
const path = require('path');
var request = require('request');
var ObjectID = require('mongodb').ObjectID;

const rp = require('request-promise');

const ADO_API_BASE = "https://dev.azure.com/{org}/{project}/_apis/wit/";
const ADO_ATTACHMENT_CREATE_ENDPOINT = `${ADO_API_BASE}attachments?fileName={fileName}&api-version=4.1`;
const ADO_WORKITEM_UPDATE_ENDPOINT = `${ADO_API_BASE}workitems/{id}?api-version=4.1`;

const keyVaultName = process.env["KEY_VAULT_NAME"];
const KVUri = "https://" + keyVaultName + ".vault.azure.net";

function getToken(resource, cb, errorFunction) {
    let options = {
        uri: `${process.env["IDENTITY_ENDPOINT"]}/?resource=${resource}&api-version=2019-08-01`,
        headers: {
            'X-IDENTITY-HEADER': process.env["IDENTITY_HEADER"]
        }
    };
    console.log(options);
    rp(options)
        .then(cb)
        .catch(errorFunction);
};

module.exports = {
    ADO_API_BASE: ADO_API_BASE,

    safeOid: function(id) {
        let safeId;
        if (isNaN(id)) {
            safeId = ObjectID(id);
        } else {
            try {
                safeId = parseInt(id);
            } catch (e) {
                safeId = id;
            }
        }
        return safeId;
    },

    isMicrosoft: function (email) {
        return email.toLowerCase().endsWith("@microsoft.com");
    },

    patToAuth: function (pat) {
        let buf = new Buffer(":" + pat);
        let base64Data = buf.toString("base64");
        return "Basic " + base64Data;
    },

    getSecret: function (secretName, cb, errorFunction) {
        console.log("Getting secret: " + secretName);
        // Use URL/ID in Azure middleware to get access token
        getToken('https://vault.azure.net', function (data) {
            console.log("Callback after getting token for vault");
            data = JSON.parse(data);

            // Then, call this endpoint with the API: {vaultBaseUrl}/secrets/{secret-name}/{secret-version}?api-version=7.0
            // https://docs.microsoft.com/en-us/rest/api/keyvault/getsecret/getsecret
            var KEY_VAULT_API_ENDPOINT = KVUri + "/secrets/" + secretName + "?api-version=7.0"

            let vaultParams = {
                url: KEY_VAULT_API_ENDPOINT,
                headers: {
                    'Authorization': 'Bearer ' + data.access_token
                }
            };
            rp(vaultParams)
                .then(cb)
                .catch(errorFunction);
        }, function (err) {
            console.log("Something went wrong");
            console.log(err);
            return errorFunction(err);
        });
    },

    cleanEmail: function(email) {
        if (email) {
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
        }

        return email;
    },

    uploadAttachments: function(files, bugId, project, callback) {
        console.log("Called uploadAttachments");
        console.log(files);

        var attachmentBodies = [];

        function uploadAndLink(fileIndex, files) {
            console.log("Called uploadAndLink on", fileIndex);
            let file = files[fileIndex];
            //console.log(file);
            let filename = file.filename;
            let filePath = path.join(process.cwd(), "uploads", filename);

            fs.readFile(filePath, (err, data) => {
                if (err) throw err;
                //console.log(data);

                let cleanContents = data;

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
                    console.log(adoResp.statusCode);

                    // TODO: Also check in /api/upload/multiple too.
                    if (adoResp.statusCode == 413) {
                        console.log("This attachment is too large");
                        fileIndex++;
                        if (files.length > fileIndex) {
                            return uploadAndLink(fileIndex, files);
                        } else {
                            return callback(attachmentBodies);
                        }
                    }

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

                    console.log(linkPatch);

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
};