'use strict';

const fs = require('fs');
const path = require('path');
var request = require('request');
var ObjectID = require('mongodb').ObjectID;

const ADO_API_BASE = "https://dev.azure.com/{org}/{project}/_apis/wit/";
const ADO_ATTACHMENT_CREATE_ENDPOINT = `${ADO_API_BASE}attachments?fileName={fileName}&api-version=4.1`;
const ADO_WORKITEM_UPDATE_ENDPOINT = `${ADO_API_BASE}workitems/{id}?api-version=4.1`;

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

    patToAuth: function (pat) {
        let buf = new Buffer(":" + pat);
        let base64Data = buf.toString("base64");
        return "Basic " + base64Data;
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