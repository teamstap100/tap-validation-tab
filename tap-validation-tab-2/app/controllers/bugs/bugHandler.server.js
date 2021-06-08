'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');
const fs = require('fs');
const path = require('path');
//const jsdom = require('jsdom');
const cheerio = require('cheerio');
const { ADO_API_BASE, uploadAttachments } = require('../../helpers/helpers.server');

function bugHandler (dbParent) {

    // "db.collection is not a function"
    var db = dbParent.db("clementine");
    var bugs = db.collection('bugs');
    var validations = db.collection('validations');
    var tenants = db.collection('tenants');
    var bugComments = db.collection('bugComments');
    var triageBugs = db.collection('triageBugs');

    const TEAMS_ADO_API_BASE = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/";

    const TEAMS_ADO_BUGS_ENDPOINT = TEAMS_ADO_API_BASE + "workitems/$bug?api-version=4.1";
    const TEAMS_ADO_WORKITEM_ADD_ENDPOINT = TEAMS_ADO_API_BASE + "workitems/$Bug?api-version=4.11";
    const TEAMS_ADO_WORKITEM_UPDATE_ENDPOINT = TEAMS_ADO_API_BASE + "workitems/{id}?api-version=4.1";
    const TEAMS_ADO_WORKITEM_COMMENTS_ENDPOINT = TEAMS_ADO_API_BASE + "workitems/{id}/comments?order=asc";

    // New way of naming things
    const TEAMS_ADO_ATTACHMENT_CREATE_ENDPOINT = TEAMS_ADO_API_BASE + "attachments";

    const QUERY_BY_WIQL_ENDPOINT = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/wiql?$top=100&api-version=5.1";
    //const QUERY_BY_WIQL_ENDPOINT = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/wiql&api-version=5.1";

    // "P1S1" in TAP Dev Test
    const TEST_P1S1_WEBHOOK = "https://microsoft.webhook.office.com/webhookb2/37317ed8-68c1-4564-82bb-d2acc4c6b2b4@72f988bf-86f1-41af-91ab-2d7cd011db47/IncomingWebhook/3227247aeb5d484fadbf3d17c0591a4c/512d26c9-aeed-4dbd-a16f-398bcf0ec3fe";

    // Production channel
    const PROD_P1S1_WEBHOOK = "https://microsoft.webhook.office.com/webhookb2/f486e90b-19bb-4f70-bc58-c819477736e4@72f988bf-86f1-41af-91ab-2d7cd011db47/IncomingWebhook/fe63a3b845914a8aaa42a556b818d5c6/512d26c9-aeed-4dbd-a16f-398bcf0ec3fe";
    const EDU_P1S1_WEBHOOK = "https://microsoft.webhook.office.com/webhookb2/2e7a9f8e-d374-4f60-9f44-199dcac216ca@72f988bf-86f1-41af-91ab-2d7cd011db47/IncomingWebhook/6f0c0b9075da4ad789e073855ed81150/512d26c9-aeed-4dbd-a16f-398bcf0ec3fe";
    const FAR_EAST_P1S1_WEBHOOK = "https://microsoft.webhook.office.com/webhookb2/62d3f821-aaa4-4278-bc81-31f4dc0b6533@72f988bf-86f1-41af-91ab-2d7cd011db47/IncomingWebhook/befb6343f0ad48fc88d5353243b7f0d6/512d26c9-aeed-4dbd-a16f-398bcf0ec3fe";

    const P1S1_WEBHOOKS = [TEST_P1S1_WEBHOOK, PROD_P1S1_WEBHOOK, EDU_P1S1_WEBHOOK, FAR_EAST_P1S1_WEBHOOK];

    // This one's for production
    // Used to run queries and write comments to workitems
    var AUTH = process.env["TEAMS-ADO-PAT"];

    // Hardcoding this Teams project instead of putting it in the DB
    var TEAMS_PROJECT = {
        org: "domoreexp",
        project: "MSTeams",
        auth: AUTH
    };

    function fixHtml(html) {
        const domObj = cheerio.load(html, { xmlMode: true });
        return domObj.html();
    }


    function cleanComment(comment) {
        comment = comment.replace("@TAP-Fenix", "");
        comment = comment.split("Attachment 1")[0];

        //comment = comment.replace(/<br>/g, "");
        comment = comment.replace(/&nbsp;/g, "");

        //comment = comment.replace(/<style[^>]*>.*<\/style>/gm, '')
        //    // Remove script tags and content
        //    .replace(/<script[^>]*>.*<\/script>/gm, '')
        //    // Remove all opening, closing and orphan HTML tags
        //    .replace(/<[^>]+>/gm, '')
        //    // Remove leading spaces and repeated CR/LF
        //    .replace(/([\r\n]+ +)+/gm, '');


        comment = fixHtml(comment);
        comment = comment.replace(/^\s*(?:<br\s*\/?\s*>)+|(?:<br\s*\/?\s*>)+\s*$/g, "");
        comment = comment.replace(/<\/br>/g, "");
        //console.log(comment);

        return comment;
    }

    /*
    function ringsToRingBlocker(rings) {

        // Takes a string like "R1.5,R3,R4" and returns the string to use for the Ring Blocker field.
        // The next ring up is the one that is blocked.
        if (rings.includes("R4")) {
            return "DoD";
        } else if (rings.includes("R3")) {
            return "3.6 - Public Preview";
        } else if (rings.includes("R1.5")) {
            return "2 - Microsoft";
        } else {
            return null;
        }
    }
    */


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

    this.getBugsConfig = function (req, res) {

        var alphaSort = { name: 1 };

        var tenantProjection = {
            name: 1,
            tid: 1,
            status: 1,
            parent: 1,
        }

        var activeTenants = {
            status: { $in: ["TAP", "EDU+TAP", "Only Ring 1.5", "TAP(Test Tenant)"] },
            parent: { $exists: false }
        };

        tenants.find(activeTenants).project(tenantProjection).sort(alphaSort).toArray(function (err, tenantDocs) {
            console.log(tenantDocs);
            res.render('bugs/config', {
                tenants: tenantDocs
            });
        })
    };

    this.getTenantBugsTemplate = function (req, res) {
        var tid = req.params.tid;
        var tenantObj;

        console.log(tid);

        if (tid == "elite") {
            validations.find({ active: true, caseOrder: "normal", tagIsPlaceholder: false, tap: "Teams", test: { $ne: true } }).project({ name: 1, tag: 1 }).sort({ name: 1 }).toArray(function (err, valDocs) {
                res.render('bugs/bugs', {
                    elite: true,
                    validations: valDocs,
                });
            })
        } else {
            tenants.findOne({ tid: tid }, {}, function (err, tenantDoc) {
                if (err) {
                    throw err;
                }

                var tenantObj = tenantDoc;

                // Note: This excludes tag-is-placeholder validations, since tagging them wouldn't be useful. Might need to encourage PMs to fix these
                validations.find({ active: true, caseOrder: "normal", tagIsPlaceholder: false, tap: "Teams", test: { $ne: true } }).project({ name: 1, tag: 1 }).sort({ name: 1 }).toArray(function (err, valDocs) {
                    return res.render('bugs/bugs', {
                        tenant: tenantObj,
                        validations: valDocs,
                    });
                })
            });
        }
    }

    function updateTenantBugs(tid, req, res) {
        var tenantObj;

        let issueWits = [];
        let witsCount = 0;
        let witsDone = false;

        var cachedBugs = [];

        let dbUpdates = 0;
        let dbCount = 0;

        var bugId;
        if (req.params.bugId) {
            bugId = req.params.bugId;
        }

        // tids will contain this tenant and child tenants' TIDs
        let tids = [];

        if (tid == "elite") {
            tenants.find({ status: "Elite" }).project({ name: 1, tid: 1 }).toArray(function (err, eliteTenantDocs) {
                //console.log(eliteTenantDocs);
                eliteTenantDocs.forEach(function (doc) {
                    tids.push(doc.tid);
                });
                tids.push("682684d9-d749-4ec4-b69b-cba80e49417e"); // Also push this one (???) - weird situation where an Elite also has a TAP tenant, and he wants to view both in the ELite channel
                //return getBugsForTids(tids, bugId);
                return checkCachedBugs(tids, bugId);
            });
        } else {
            tids.push(tid);

            tenants.findOne({ tid: tid }, {}, function (err, tenantDoc) {
                if (err) {
                    throw err;
                }

                tenantObj = tenantDoc;
                //console.log(tenantDoc.name);

                tenants.find({ parent: tid }).project({ name: 1, tid: 1, parent: 1 }).toArray(function (err, childDocs) {
                    childDocs.forEach(function (doc) {
                        tids.push(doc.tid);
                    })
                    //return getBugsForTids(tids, bugId);
                    return checkCachedBugs(tids, bugId);
                });
            });
        }

        function checkCachedBugs(tids, bugId) {
            let ninety_days_ago = new Date(Date.now() - 24 * 3600 * 1000 * 90);
            triageBugs.find({ tid: { $in: tids }, timestamp: { $gt: ninety_days_ago } }).sort({ timestamp: -1 }).toArray(function (err, bugs) {
                let one_hour_ago = new Date(Date.now() - 3600 * 1000)
                if (bugs.length > 0) {
                    // bugs.forEach(function (bug) {
                    //    console.log(bug);
                    //});
                    let lastBugRefresh = bugs[0].timestamp;
                    if (lastBugRefresh > one_hour_ago) {
                        console.log("Bugs were updated recently");
                        cachedBugs = bugs;
                        //console.log(cachedBugs);

                        // "Created date" can only be searched by date, not anything more precise.
                        return getBugsForTids(tids, bugId, '@today-1')
                        //return res.json({
                        //    tenant: tenantObj,
                        //    bugs: bugs
                        //});
                    } else {
                        console.log("Bug cache is old");
                        //console.log(lastBugRefresh, one_hour_ago);
                        return getBugsForTids(tids, bugId, "@today-90");
                    }
                } else {
                    console.log("No bug cache, starting from scratch");
                    return getBugsForTids(tids, bugId, '@today-90');
                }
            });
        }

        function getBugsForTids(tids, bugId, lastBugRefresh) {
            //console.log("getBugsForTids on:");
            //console.log(tids);
            //console.log(cachedBugs);

            var body = {
                "query": "Select [System.Id] from WorkItems order by [System.CreatedDate] desc Where [System.WorkItemType] = 'Bug' and [System.CreatedDate] > " + lastBugRefresh + " and [System.Tags] Not Contains 'TAPSurvey' and [System.Tags] Not Contains 'TAPValidationComment' and ("
            };

            tids.forEach(function (tid) {
                body.query += ' or ';
                body.query += "[MicrosoftTeamsCMMI.CustomerName] = '" + tid + "'";
            })

            body.query = body.query.replace("( or", '(');
            body.query += ")"

            //console.log(bugId);

            if (bugId) {
                body.query += " and [System.Id] = " + bugId;
            }

            //console.log(body);

            var options = {
                url: QUERY_BY_WIQL_ENDPOINT,
                headers: {
                    'Authorization': AUTH,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            };

            //console.log(options);

            request.post(options, function (adoErr, adoResponse, adoBody) {
                if (adoErr) {
                    console.log(adoErr);
                    throw adoErr;
                }
                console.log(adoResponse.statusCode);
                //console.log(adoBody);
                adoBody = JSON.parse(adoBody);
                //console.log(adoBody);
                var workitems = adoBody.workItems;
                witsCount = adoBody.workItems.length;

                workitems.forEach(function (wit) {

                    var witOptions = {
                        url: wit.url,
                        headers: {
                            'Authorization': AUTH,
                        }
                    }

                    //console.log(wit.url);

                    request.get(witOptions, function (adoErr, adoResponse, adoBody) {
                        //console.log(adoResponse.statusCode);
                        if (adoErr) {
                            console.log("Here's an ado err:");
                            console.log(adoErr);
                        }
                        //console.log(adoBody);
                        //console.log(adoResponse);
                        console.log(adoResponse.statusCode);
                        if (adoResponse.statusCode.toString()[0] == "5") {
                            console.log("Server error");
                            return res.status(500).send();
                        }

                        // TDOO: Handle JSON parsing error here when it hits a limit
                        let workitem = JSON.parse(adoBody);

                        //console.log(workitem);  

                        var commentOptions = {
                            url: wit.url + "/comments?order=asc",
                            headers: {
                                'Authorization': AUTH
                            }
                        };

                        //console.log(commentOptions);

                        request.get(commentOptions, function (commentErr, commentStatus, commentResponse) {
                            if (commentErr) {
                                console.log(commentErr);
                                throw commentErr;
                            }
                            console.log(commentResponse);
                            if (commentStatus.statusCode.toString()[0] == "5") {
                                console.log("Server error");
                                return res.status(500).send();
                            }

                            let resp = JSON.parse(commentResponse);
                            let comments = resp.comments;

                            // We only want to display comments that are either:
                            // 1) Containing a TAP-Fenix invocation (and are sent to the customer)
                            // 2) Written by TAP-Fenix (Either a Fenix reply, or one of the triage actions from the tenant tab)

                            // (We really just want the number of comments here, the actual comments are fetched from this.getBugComments with ajax)

                            let fenixComments = [];

                            comments.forEach(function (comment) {
                                // Comments coming from dev
                                if (comment.text.includes("TAP-Fenix")) {
                                    fenixComments.push(comment);

                                    // Comments coming from customer, or dev thru tap-fenix
                                    // TEMP: Also including my alias, since the new PAT is not generated yet
                                } else if ((comment.createdBy.uniqueName == "tapfenix@microsoft.com") || (comment.createdBy.uniqueName == "v-maxsil@microsoft.com")) {
                                    if (!(comment.text.includes("MAU"))) {
                                        fenixComments.push(comment);
                                    }
                                }
                            })
                            //workitem.comments = fenixComments;
                            workitem.commentCount = fenixComments.length;

                            issueWits.push(workitem);

                            witsDone += 1;
                            checkIfDone();
                        });
                    })
                })

                // In case there are no workitems
                checkIfDone();
            });
        }

        function checkIfDone() {
            //console.log(witsDone + " / " + witsCount);
            if (witsDone == witsCount) {
                finalRender();
            }
        }

        function checkIfDbDone() {
            console.log(dbUpdates + " / " + dbCount);
            if (dbUpdates == dbCount) {
                console.log("Done");
                return;
            }
        }

        function finalRender() {
            console.log("Consolidating");

            let simpleBugs = [];

            issueWits.forEach(function (wit) {
                //console.log(wit);

                let shortSteps = wit.fields["Microsoft.VSTS.TCM.ReproSteps"] || "";
                //console.log(shortSteps);

                if (shortSteps.includes("System info")) {
                    shortSteps = shortSteps.split("System info:")[0];
                }


                if (shortSteps.includes("All the logs &amp; screenshots")) {
                    shortSteps = shortSteps.split("All the logs &amp; screenshots")[0];
                }

                // For some mobile bugs
                if (shortSteps.includes("=============================")) {
                    shortSteps = shortSteps.split("=============================")[0];
                }

                if (shortSteps.includes(' style="box-sizing:border-box;"')) {
                    shortSteps = shortSteps.replace(/ style="box-sizing:border-box;"/g, '');
                }


                shortSteps = shortSteps.split("<hr><br>")[1];

                //console.log(shortSteps);

                let state = wit.fields["System.State"];
                let closeRequested = false;
                //console.log(wit.fields["System.Tags"]);
                if (wit.fields["System.Tags"]) {
                    if ((wit.fields["System.Tags"].includes("TAPITAdminRequestingClose")) && (state != "Closed")) {
                        state = "Close Requested";
                        closeRequested = true;
                    }

                    if (wit.fields["System.Tags"].includes("TAPAdminS1")) {
                        // TODO: Confusingly, I'm setting wit.priority to the "severity" value. This gets used in the bug triage stats page
                        wit.priority = "P1S1";
                    } else if (wit.fields["System.Tags"].includes("TAPAdminS2")) {
                        wit.priority = "S2";
                    } else {
                        wit.priority = "S3";
                    }
                } else {
                    wit.priority = "S3";
                }

                let triaged = false;
                if (wit.fields["System.Tags"]) {
                    if (wit.fields["System.Tags"].includes("TAPITAdminTriaged")) {
                        triaged = true;
                    }
                }

                let reason = wit.fields["Microsoft.VSTS.Common.ResolvedReason"];
                if (reason == null) {
                    reason = "";
                }
                //if (reason == "Moved out of state Blocked") {
                //    reason = "Not Blocked";
                //}

                simpleBugs.push({
                    DT_RowId: wit.id,
                    _id: wit.id,
                    id: wit.id,
                    date: new Date(wit.fields["System.CreatedDate"]),
                    title: wit.fields["System.Title"],
                    tags: wit.fields["System.Tags"],
                    state: state,
                    reason: reason,
                    reproSteps: shortSteps || "",
                    submitter: wit.fields["MicrosoftTeamsCMMI.CustomerEmail"] || "",
                    // Let's track tenant ID too
                    tid: wit.fields["MicrosoftTeamsCMMI.CustomerName"],
                    //statusTweet: wit.fields["MicrosoftTeamsCMMI.StatusTweet"] || "",
                    triaged: triaged,
                    closeRequested: closeRequested,
                    //history: wit.fields["System.History"] || "",
                    //comments: wit.comments,
                    areaPath: wit.fields["System.AreaPath"],
                    commentCount: wit.commentCount,
                    priority: wit.priority,
                    timestamp: new Date(),
                });
            });

            console.log(simpleBugs.length + " newly-fetched bugs");

            let simplePlusCached = [];
            simpleBugs.forEach(function (sb) {
                simplePlusCached.push(sb);
            })
            cachedBugs.forEach(function (cb) {
                // This step is redundant for now
                if (cb.closeRequested) {
                    cb.state = "Close Requested";
                }

                if (simplePlusCached.find(x => x.id == cb.id)) {
                    console.log("Skipping duplicate");
                    return;
                } else {
                    simplePlusCached.push(cb);
                }
            });

            console.log(simplePlusCached.length + " total bugs");
            console.log(cachedBugs.length + " cached bugs");

            //console.log(simplePlusCached);

            res.json({
                tenant: tenantObj,
                bugs: simplePlusCached,
            });

            dbCount = simpleBugs.length;

            // Do the database work after it's rendered
            simpleBugs.forEach(function (bug) {
                triageBugs.findOne({ id: bug._id }, function (err, existingBug) {
                    if (existingBug) {
                        // Note: We'll always be updating this bug, as the timestamp (last updated) field will always be set to now.
                        // Removed the previous branch for "bug is exactly the same"
                        triageBugs.updateOne({ _id: bug._id }, { $set: bug }, function (err, updatedBug) {
                            if (err) { console.log(err); }
                            console.log("Updated bug");
                            dbUpdates++;
                            return checkIfDbDone();
                        });
                    } else {
                        triageBugs.insertOne(bug, function (err, bugDoc) {
                            console.log(bug._id + " is new");
                            dbUpdates++;
                            return checkIfDbDone();
                        });
                    }
                })
            });
        }
    }

    this.getTenantBugs = function (req, res) {
        console.log("Calling getTenantBugs");
        console.log(req.params);
        var tid = req.params.tid;

        return updateTenantBugs(tid, req, res);
    }

    this.renderBugsSummary = function (req, res) {
        let summaryId = req.params.summaryId;
        console.log(summaryId);

        let one_week_ago = new Date(Date.now() - 24 * 3600 * 1000 * 7);
        let ninety_days_ago = new Date(Date.now() - 24 * 3600 * 1000 * 90);
        let query = { bug_hook_url: { $exists: true }};
        if ((summaryId == null) || (summaryId == "Customers")) {
            query.status = { $ne: "Elite" };
            query.tap = { $ne: "EDU+TAP" };
        } else if (summaryId == "EDU") {
            query.tap = "EDU+TAP";
        } else if (summaryId == "FarEast") {
            // TODO: Not quite correct - 
            query.region = "APAC";
        }
        console.log(query);

        tenants.find(query).project({ name: 1, tid: 1, parent: 1, bug_tab_url: 1 }).sort({ name: 1 }).toArray(function (err, tenantDocs) {
            triageBugs.find({ timestamp: { $gte: ninety_days_ago }}).project({ tid: 1, triaged: 1, closeRequested: 1, timestamp: 1 }).toArray(function (err, bugDocs) {
                tenantDocs.forEach(function (tenant) {
                    let tids = [tenant.tid];
                    tenantDocs.forEach(function (otherTenant) {
                        if (otherTenant.parent == tenant.tid) {
                            tids.push(otherTenant.tid);
                        }
                    });

                    tenant.bugs = bugDocs.filter(bug => tids.includes(bug.tid));
                    tenant.triagedBugs = bugDocs.filter(bug => (tids.includes(bug.tid) && bug.triaged));
                    tenant.closedBugs = bugDocs.filter(bug => (tids.includes(bug.tid) && bug.closeRequested));
                })
                tenantDocs = tenantDocs.filter(tenant => tenant.parent == null);

                return res.render('bugs/summary', {
                    tenants: tenantDocs,
                });
            });

        });
    }

    this.getBugComments = function (req, res) {
        var refUrlParts = req.url.split('/');
        const bId = parseInt(refUrlParts.pop());

        if (bId == null) {
            return res.status(400).send();
        }

        let comments_url = TEAMS_ADO_WORKITEM_COMMENTS_ENDPOINT.replace("{id}", bId);

        var commentOptions = {
            url: comments_url,
            headers: {
                'Authorization': AUTH
            }
        };

        console.log(commentOptions);

        request.get(commentOptions, function (commentErr, commentStatus, commentResponse) {
            let resp = JSON.parse(commentResponse);
            let comments = resp.comments;

            // We only want to display comments that are either:
            // 1) Containing a TAP-Fenix invocation (and are sent to the customer)
            // 2) Written by TAP-Fenix (Either a Fenix reply, or one of the triage actions from the tenant tab)

            let fenixComments = [];

            comments.forEach(function (comment) {
                // Comments coming from dev
                if (comment.text.includes("TAP-Fenix")) {
                    let cleanedComment = cleanComment(comment.text);
                    comment.text = cleanedComment;
                    fenixComments.push(comment);

                    // Comments coming from customer, or dev thru tap-fenix
                } else if ((comment.createdBy.uniqueName == "tapfenix@microsoft.com") || (comment.createdBy.uniqueName == "v-maxsil@microsoft.com")) {
                    let cleanedComment = cleanComment(comment.text);
                    comment.text = cleanedComment;
                    if (!(comment.text.includes("MAU"))) {
                        fenixComments.push(comment);
                    }
                }
            })
            fenixComments.forEach(function (comment) {
                console.log(comment.text);
            })
            return res.json({ comments: fenixComments });
        });
    }

    this.triageBug = function (req, res) {
        console.log(req.body);

        //let submitter = req.body.submitter;
        let submitter = req.user.preferred_username;
        let submitterName = req.user.name;
        console.log(submitter, submitterName);

        let rings = req.body.rings;
        let extent = req.body.extent;
        let everWorked = req.body.everWorked;
        let meetingsPerf = req.body.meetingsPerf;
        let validationName = req.body.validationName;
        let cfl = req.body.cfl;

        //let tabUrl = req.body.tabUrl;

        let comment_url = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/workItems/" + req.body.id + "/comments?api-version=5.1-preview.3";
        let modify_wit_url = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/workitems/" + req.body.id + "?api-version=5.1";

        let getWitOptions = {
            url: modify_wit_url,
            headers: {
                'Authorization': AUTH,
            },
        };

        request.get(getWitOptions, function (adoErr, adoResponse, adoBody) {
            if (adoErr) { throw adoErr; }
            let resp = JSON.parse(adoBody);
            //console.log(resp);

            let existingTags = resp.fields["System.Tags"];
            // Ignore "undefined" when the existing tag list is empty
            if (existingTags == "undefined") {
                existingTags = "";
            }
            //console.log(existingTags);

            let tagList = existingTags + "; TAPITAdminTriaged;"

            if (meetingsPerf == "Yes") {
                tagList += " MeetingsPerf;";
            }

            //let comment = submitter + " provided this triage info through the Tenant Bugs tab:<br />Users affected: " + extent + "<br />Rings this repros in: " + rings + "<br />Has this ever worked? " + everWorked + "<br />Related to meetings perf? " + meetingsPerf;
            let comment = `${submitterName} (${submitter}) provided this triage info through the Tenant Bugs tab:
                Users affected: ${extent}
                Is this impacting critical business needs? ${cfl}
                Rings this repros in: ${rings}
                Has this ever worked? ${everWorked}
                Related to meetings perf? ${meetingsPerf}`


            if (validationName) {
                comment += "<br />Validation: " + validationName;
            }

            comment = comment.replace(/\n/g, "<br />");

            var reqBody = {
                text: comment
            }

            var options = {
                url: comment_url,
                headers: {
                    'Authorization': AUTH,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(reqBody)
            };

            request.post(options, function (adoErr, adoResponse, adoBody) {
                if (adoErr) { throw adoErr; }
                //console.log(adoBody);

                let patch = [];

                let severity = "3 - Medium";
                let priority = 2;

                // Only set S1 if CFL = yes.
                // 1 - Critical, 2 - High, 3 - Medium

                // See this page for a nice table of the business logic.
                // https://microsoft.sharepoint.com/teams/CustomerValidationProgramCVP/_layouts/15/Doc.aspx?sourcedoc={d92a62b8-1700-40ed-9cc6-815e7c2a8b34}&action=edit&wd=target%28TAP%20Specs.one%7Cb1078b94-a090-4271-a677-c9f9db3a0439%2FTAP%20IT%20admin%20self-triage%20v2%20spec%7Cc2256616-8572-4fc5-b980-a9b94955b577%2F%29

                if (cfl == "Yes") {
                    if ((extent == "Several") || (extent == "All")) {
                        severity = "1 - Critical";
                        priority = 1;
                        tagList += " TAPAdminS1; TAPAdminP1;";
                    } else {
                        severity = "2 - High";
                        priority = 1;
                        tagList += " TAPAdminS2; TAPAdminP1;";
                    }
                } else {
                    if (req.body.extent == "Several") {
                        if (req.body.everWorked == "Yes") {
                            severity = "2 - High";
                            priority = 1;
                            tagList += " TAPAdminS2; TAPAdminP1;";
                        } else {
                            severity = "2 - High";
                            tagList += " TAPAdminS2;";
                        }
                    } else if (req.body.extent == "All") {
                        severity = "2 - High";
                        priority = 1;
                        tagList += " TAPAdminS2; TAPAdminP1;";
                    }
                }


                patch.push({
                    op: "add",
                    path: "/fields/Microsoft.VSTS.Common.Severity",
                    value: severity
                });

                if (priority != 2) {
                    patch.push({
                        op: "add",
                        path: "/fields/Microsoft.VSTS.Common.Priority",
                        value: priority
                    });
                }

                function sendPatch(patch) {
                    console.log(patch);
                    let patchOptions = {
                        url: modify_wit_url,
                        headers: {
                            'Authorization': AUTH,
                            'Content-Type': 'application/json-patch+json'
                        },
                        body: JSON.stringify(patch)
                    }

                    request.patch(patchOptions, function (adoErr, adoResponse, adoBody) {
                        if (adoErr) { console.log(adoErr); }
                        //console.log(adoBody);

                        let safeId = parseInt(req.body.id);

                        let updateQuery = {
                            $set: {
                                triaged: true,
                                priority: priority,
                                severity: severity,
                                triagedBy: submitter,
                            }
                        }

                        triageBugs.updateOne({ _id: safeId }, updateQuery, function (err, doc) {
                            if (err) {
                                console.log("Failed to update bug with id: " + safeId);
                            } else {
                                console.log("Marked bug " + safeId + " as triaged");
                            }
                            return res.status(200).send();
                        });
                    })
                }

                function sendTeamsCard() {
                    console.log("Called sendTeamsCard");
                    const cardTemplate = {
                        "@type": "MessageCard",
                        "@context": "https://schema.org/extensions",
                        "summary": "{Bug Title}",
                        "themeColor": "0078D7",
                        "title": "{Bug Title}",
                        "sections": [
                            {
                                "activityTitle": "#{BUG_ID}](https://domoreexp.visualstudio.com/MSTeams/_workitems/edit/{BUG_ID}) - {BUG_TITLE}",
                                "activityImage": "https://i.imgur.com/xqG1HMv.png",
                                "activityText": "{Bug Description}",
                                "facts": [
                                    {
                                        "name": "Reported By",
                                        "value": "{Bug Tenant Name}"
                                    },
                                    {
                                        "name": "Ask",
                                        "value": "If your tenant is also experiencing this symptom, please triage the bug from your users and inform your helpdesk ASAP.",
                                    },
                                ]
                            }
                        ]
                    }

                    let safeId = parseInt(req.body.id);
                    triageBugs.findOne({ _id: safeId }, function (err, bugDoc) {
                        if (err) {
                            console.log(err);
                        }
                        if (bugDoc == null) {
                            console.log("Bug not found");
                            return;
                        }

                        if (bugDoc.notificationSent) {
                            console.log("This notification has already been sent - skip it");
                            return;
                        }

                        tenants.findOne({ tid: bugDoc.tid }, function (err, tenantDoc) {
                            let tenantName = "A customer";
                            if (tenantDoc) {
                                tenantName = tenantDoc.name;
                            }
                            var card = Object.assign({}, cardTemplate);

                            let safeTitle = bugDoc.title;
                            if (safeTitle.split(":").length > 1) {
                                safeTitle = safeTitle.split(":").slice(2).join(":");
                            }
                            bugDoc.safeTitle = safeTitle;
                            bugDoc.safeReproSteps = bugDoc.reproSteps.replace("Message:", "");

                            //card.summary = "A bug has been marked high-priority";
                            card.title = `${tenantName} has submitted a high-severity issue`;
                            card.sections[0].activityTitle = `[${bugDoc.id}](https://domoreexp.visualstudio.com/MSTeams/_workitems/edit/${bugDoc.id}) - ${bugDoc.safeTitle}`;
                            card.sections[0].activityText = bugDoc.safeReproSteps;
                            card.sections[0].facts[0].value = tenantName;

                            P1S1_WEBHOOKS.forEach(function (hook) {
                                let params = {
                                    url: hook,
                                    headers: {
                                        "content-type": "application/json"
                                    },
                                    body: JSON.stringify(card),
                                };

                                console.log(card);
                                console.log(hook);

                                request.post(params, function (err, resp, body) {
                                    console.log(resp.body);
                                    // TODO: This sets notificationSent to true after the first one succeeds, not after they all succeed.
                                    triageBugs.updateOne({ _id: safeId }, { $set: { notificationSent: true, sevA: true } }, function (err, updateDoc) {
                                        console.log("Set notificationSent to true");
                                    });
                                });
                            });
                        })
                    });
                }

                // Notify a Teams channel if this is P1S1 or P1S2
                console.log(priority);
                if (priority == 1) {
                    console.log("Sending a Teams card");
                    sendTeamsCard();
                }

                if (validationName) {
                    validations.findOne({ name: validationName }, { projection: { name: 1, tag: 1 } }, function (err, valDoc) {
                        if (valDoc == null) {
                            console.log("No validation found with name: " + validationName);
                            return res.status(200).send();
                        } else {
                            patch.push({
                                op: "add",
                                path: "/fields/System.Tags",
                                value: tagList + valDoc.tag
                            });

                            return sendPatch(patch);
                        }
                    });
                } else {
                    console.log("No validation name provided");
                    patch.push({
                        op: "add",
                        path: "/fields/System.Tags",
                        value: tagList,
                    });

                    return sendPatch(patch);
                }
            });
        });

        
    }

    this.addComment = function (req, res) {
        console.log(req.body);

        let submitter = req.user.preferred_username;
        let submitterName = req.user.name;
        console.log(submitter, submitterName);


        let comment = 'IT Admin submitted a comment through the Tenant Bugs tab:<br />"' + req.body.comment + '" - ' + submitterName + " (" + submitter + ")";
        if (req.body.attachmentFilename) {
            comment += `<br />[Attachment - ${req.body.attachmentFilename}]`;
        }

        let modify_wit_url = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/workitems/" + req.body.id + "?api-version=5.1";

        let getWitOptions = {
            url: modify_wit_url,
            headers: {
                'Authorization': AUTH,
            },
        };

        request.get(getWitOptions, function (adoErr, adoResponse, adoBody) {
            let resp = JSON.parse(adoBody);
            console.log(resp);

            let existingTags = resp.fields["System.Tags"];
            console.log(existingTags);


            let patch = [
                {
                    op: "add",
                    path: "/fields/System.History",
                    value: comment
                }
            ];

            // New tag shows when IT admins have commented
            patch.push({
                op: "add",
                path: "/fields/System.Tags",
                value: existingTags + "; TAPITAdminCommented"
            });

            let patchOptions = {
                url: modify_wit_url,
                headers: {
                    'Authorization': AUTH,
                    'Content-Type': 'application/json-patch+json'
                },
                body: JSON.stringify(patch)
            }

            request.patch(patchOptions, function (adoErr, adoResponse, adoBody) {
                console.log(adoBody);

                // Handle attachments if necessary
                if (req.body.attachmentFilename) {
                    // The attachment is given the filename in req.body.attachmentFilename. It is at uploads/req.body.attachmentFilename.

                    let filePath = path.join(__dirname, '../../../uploads', req.body.attachmentFilename);
                    console.log(filePath);

                    fs.readFile(filePath, (err, data) => {
                        if (err) throw err;
                        console.log(data);

                        let cleanContents = data;
                        //console.log(cleanContents);

                        let attachment_endpoint = TEAMS_ADO_ATTACHMENT_CREATE_ENDPOINT + "?fileName=" + req.body.attachmentFilename + "&api-version=4.1";

                        let attachmentOptions = {
                            url: attachment_endpoint,
                            headers: {
                                'Authorization': AUTH,
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
                                url: TEAMS_ADO_WORKITEM_UPDATE_ENDPOINT.replace('{id}', req.body.id),
                                headers: {
                                    'Authorization': AUTH,
                                    'Content-Type': 'application/json-patch+json',
                                },
                                body: JSON.stringify(linkPatch),
                            }

                            request.patch(linkOptions, function (adoErr, adoStatus, adoResponse) {
                                if (adoErr) { throw err; }

                                let safeId = parseInt(req.body.id);
                                let updateQuery = {
                                    $set: {
                                        commented: true,
                                        triagedBy: submitter,
                                    }
                                }
                                triageBugs.updateOne({ _id: safeId }, updateQuery, function (err, doc) {
                                    if (err) {
                                        console.log("Failed to update bug with id: " + safeId);
                                    } else {
                                        console.log("Marked bug " + safeId + " as commented");
                                    }
                                    return res.status(200).send();
                                });
                            });

                        });
                    });
                } else {
                    return res.status(200).send();
                }
            });
        })
    }

    function closeBug(req, callback) {
        console.log("Calling closeBug");
        console.log(req.body);

        let submitter = req.user.preferred_username;
        let submitterName = req.user.name;
        console.log(submitter, submitterName);


        let comment = 'IT Admin submitted a request to close this bug through the Tenant Bugs tab. The comment was: <br />"' + req.body.comment + '" - ' + submitterName + " (" +  submitter + ")";

        let modify_wit_url = "https://dev.azure.com/domoreexp/MSTeams/_apis/wit/workitems/" + req.body.id + "?api-version=5.1";

        let getWitOptions = {
            url: modify_wit_url,
            headers: {
                'Authorization': AUTH,
            },
        };

        request.get(getWitOptions, function (adoErr, adoResponse, adoBody) {
            let resp = JSON.parse(adoBody);
            console.log(resp);

            let existingTags = resp.fields["System.Tags"];
            console.log(existingTags);

            let patch = [];

            if (req.body.duplicateId) {
                let linkId = parseInt(req.body.duplicateId);
                let duplicatedUrl = "https://domoreexp.visualstudio.com/MSTeams/_workitems/edit/" + linkId

                patch.push({
                    "op": "add",
                    "path": "/relations/-",
                    "value": {
                        "rel": "System.LinkTypes.Duplicate-Reverse",
                        "url": duplicatedUrl
                    }
                });
                comment += "<br />Marked as duplicate of: <a href='" + duplicatedUrl + "'>" + req.body.duplicateId + "</a>";
            }

            patch.push({
                op: "add",
                path: "/fields/System.Tags",
                value: existingTags + "; TAPITAdminRequestingClose"
            });

            patch.push({
                op: "add",
                path: "/fields/System.History",
                value: comment
            })

            let patchOptions = {
                url: modify_wit_url,
                headers: {
                    'Authorization': AUTH,
                    'Content-Type': 'application/json-patch+json'
                },
                body: JSON.stringify(patch)
            }

            request.patch(patchOptions, function (adoErr, adoResponse, adoBody) {
                let safeId = parseInt(req.body.id);
                let updateQuery = {
                    $set: {
                        closeRequested: true,
                        state: "Close Requested",
                        triagedBy: submitter,
                    }
                }
                triageBugs.updateOne({ _id: safeId }, updateQuery, function (err, doc) {
                    if (err) {
                        console.log("Failed to update bug with id: " + safeId);
                    } else {
                        console.log("Marked bug " + safeId + " as closeRequested");
                    }
                    console.log(doc);
                    return callback();
                });
            })
        });
    }

    this.closeBug = function (req, res) {
        closeBug(req, function () {
            res.status(200).send()
        });
    }

    this.bulkCloseBugs = function (req, res) {
        function checkIfDone() {
            console.log("Checking if done");
            console.log(counter + " / " + bugCount);
            if (counter == bugCount) {
                return res.status(200).send();
            }
        }

        console.log("Calling closeBug");
        console.log(req.body);

        var counter = 0;
        var bugCount = req.body.ids.length;

        req.body.ids.forEach(function (bugId) {
            // Call closeBug with 
            let params = req;
            params.body.id = bugId;

            closeBug(params, function () {
                console.log("Returned from this function")
                counter++;
                checkIfDone();
            });
        })

    }

    this.renderSevABugs = function (req, res) {
        tenants.find({}).project({ tid: 1, name: 1 }).toArray(function (err, tenantDocs) {
            triageBugs.find({ notificationSent: true, state: { $nin: ["Closed", "Resolved", "Close Requested"] } }).toArray(function (err, bugDocs) {
                console.log(bugDocs);
                bugDocs.forEach(function (bugDoc) {
                    let safeTitle = bugDoc.title;
                    if (safeTitle.split(":").length > 2) {
                        safeTitle = safeTitle.split(":").slice(2).join(":");
                    }
                    bugDoc.safeTitle = safeTitle;

                    let thisTenant = tenantDocs.find(x => x.tid == bugDoc.tid);
                    if (thisTenant) {
                        bugDoc.tenantName = thisTenant.name;
                    } else {
                        bugDoc.tenantName = "?";
                    }
                })

                return res.render('bugs/sevABugs', {
                    bugs: bugDocs
                });
            });
        })
    }

    this.renderBugReportConfig = function (req, res) {
        return res.render('bugs/bugReportConfig', {});
    }

    this.renderBugReport = function (req, res) {
        return res.render('bugs/bugReport');
    }

    function createTeamsBug(body, callback) {
        console.log(body);
        let bugTitle = "MTR Bug Report: "
        let tags = "TAPMTRBugReport; TAP";

        let safeComment = body.comment.replace(/\r?\n/g, '<br />');
        bugTitle += '"' + safeComment + '"';

        let annotatedComment = `"${safeComment}"<br /><br />Submitted by ${body.user.name} (${body.user.email}) through the MTR Bug Report Form in Teams.`;

        if (bugTitle.length > 200) {
            bugTitle = bugTitle.slice(0, 197) + "...";
        }

        let domain = body.user.email.split("@")[1];

        tenants.findOne({ domains: domain }, function (err, tenantDoc) {
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
                    "value": annotatedComment,
                },
                {
                    "op": "add",
                    "path": "/fields/System.AreaPath",
                    "value": "MSTeams\\Customer Feedback\\TAP"
                },
                {
                    "op": "add",
                    "path": "/fields/MicrosoftTeamsCMMI.CustomerName",
                    "value": tenantDoc.tid
                },
                {
                    "op": "add",
                    "path": "/fields/MicrosoftTeamsCMMI.CustomerEmail",
                    "value": body.user.email
                },
                {
                    "op": "add",
                    "path": "/fields/MicrosoftTeamsCMMI.CustomerTenantName",
                    "value": tenantDoc.name
                }
            ];

            let apiUrl = TEAMS_ADO_WORKITEM_ADD_ENDPOINT;

            const options = {
                url: apiUrl,
                headers: {
                    'Authorization': AUTH,
                    'Content-Type': 'application/json-patch+json'
                },
                body: JSON.stringify(reqBody)
            };

            console.log("Create workitem options:");
            console.log(options);

            request.post(options, function (adoErr, adoResp, adoBody) {
                if (adoErr) { throw adoErr; }

                console.log(adoBody);
                return callback(adoBody);

            });
        });
    }

    this.submitBugReport = function (req, res) {
        console.log(req.body);
        console.log(req.user);

        req.body.user = req.user;

        var bugId;

        createTeamsBug(req.body, function (adoBody) {
            console.log(adoBody);
            adoBody = JSON.parse(adoBody);
            bugId = adoBody.id;
            console.log("bugId is", bugId);
            // Handle attachments
            if (req.body.attachments) {
                if (req.body.attachments.length > 0) {
                    console.log("Handling attachments");
                    uploadAttachments(req.body.attachments, bugId, TEAMS_PROJECT, function (attachmentBodies) {
                        console.log(attachmentBodies);
                        return res.status(200).send();
                    });
                } else {
                    return res.status(200).send();
                }
            } else {
                return res.status(200).send();
            }
        });
    }
}

module.exports = bugHandler;