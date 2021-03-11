'use strict';

//var ClickHandler = require(process.cwd() + '/app/controllers/clickHandler.server.js');
var ValidationHandler = require(process.cwd() + '/app/controllers/validation/validationHandler.server.js');
var BugHandler = require(process.cwd() + '/app/controllers/bugs/bugHandler.server.js');
var CaseHandler = require(process.cwd() + '/app/controllers/validation/caseHandler.server.js');
var IssueHandler = require(process.cwd() + '/app/controllers/knownIssues/issueHandler.server.js');
var TenantHandler = require(process.cwd() + '/app/controllers/users/tenantHandler.server.js');
var PerformanceHandler = require(process.cwd() + '/app/controllers/performance/performanceHandler.server.js');
var UserHandler = require(process.cwd() + '/app/controllers/users/userHandler.server.js');
var FeedbackHandler = require(process.cwd() + '/app/controllers/validation/feedbackHandler.server.js');
var FeatureRequestHandler = require(process.cwd() + "/app/controllers/validation/featureRequestHandler.server.js");
var InfoHandler = require(process.cwd() + "/app/controllers/tap100-app/infoHandler.server.js");
var AnalyticsHandler = require(process.cwd() + "/app/controllers/analyticsHandler.server.js");
var FeatureHandler = require(process.cwd() + "/app/controllers/features/featureHandler.server.js");
var UserHandler = require(process.cwd() + "/app/controllers/users/userHandler.server.js");

var multer = require('multer');
var path = require('path');
const cron = require('node-cron');

const { enforceLoginTeams, enforceIdToken, } = require(process.cwd() + "/app/routes/helpers.js");

const LOCAL_TEST_TOKEN = [{ "id_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6Im5PbzNaRHJPRFhFSzFqS1doWHNsSFJfS1hFZyJ9.eyJhdWQiOiJiOGQwMTQ2NC1jM2ZjLTQ1NzMtYTJjMy01NWVkOTExMzYyMGMiLCJpc3MiOiJodHRwczovL2xvZ2luLm1pY3Jvc29mdG9ubGluZS5jb20vNzJmOTg4YmYtODZmMS00MWFmLTkxYWItMmQ3Y2QwMTFkYjQ3L3YyLjAiLCJpYXQiOjE2MTU0ODM1MDIsIm5iZiI6MTYxNTQ4MzUwMiwiZXhwIjoxNjE1NDg3NDAyLCJhY2N0IjowLCJhaW8iOiJBWFFBaS84VEFBQUE0dllNcWJNeUU3bGhhU3RRUTlrbGlsa3JaS0FjYUtWTEdIVEVFSnR6YzJUa1UwS3U2K0FxeXRHWnpJakdnWnF0b25hM2Y2ejFIOEhmQ2VOVWpGS3VORjhiOE9rNTFhWFFxT1BYV1E1MjdEc0pScGhYS3RSTG1ZNU5IbDZxZUFyMEpaY0VxWUtkTk8wdzU3ZXN2cDRaU0E9PSIsImVtYWlsIjoidi1tYXhzaWxAbWljcm9zb2Z0LmNvbSIsIm5hbWUiOiJNYXggU2lsYmlnZXIgKE1JTkRUUkVFIExJTUlURUQpIiwibm9uY2UiOiI2ZDFiYjRkNmI0NGU0Mjk3YjY2YWViYTc4NzA3YzQxOV8yMDIxMDMxMTE3MzUwMSIsIm9pZCI6IjUxMmQyNmM5LWFlZWQtNGRiZC1hMTZmLTM5OGJjZjBlYzNmZSIsInByZWZlcnJlZF91c2VybmFtZSI6InYtbWF4c2lsQG1pY3Jvc29mdC5jb20iLCJyaCI6IjAuQVJvQXY0ajVjdkdHcjBHUnF5MTgwQkhiUjJRVTBMajh3M05Gb3NOVjdaRVRZZ3dhQU5NLiIsInN1YiI6IjRlNVhFek5naFN4bm1TVWlZLTVFOUhrLWhnTXN3TnJwX3k5b3pTaHk3aGciLCJ0aWQiOiI3MmY5ODhiZi04NmYxLTQxYWYtOTFhYi0yZDdjZDAxMWRiNDciLCJ1dGkiOiJxM3k3ZGZBeXIwNmdvMDE3N2hrdUFBIiwidmVyIjoiMi4wIn0.IS7hnu9Re0DOwN7B9PkDF0kvTKOTgwQcCyTHraC3IfIBynt0gel0558caQ5UULkj91NhheLdqK1Al0CAOXzgr0_Twbfr-_uCoM4jziBy3PlrKWk9uiGQECqGMHXd5wiWdnnq6u1hpOTMdoZP8y001DvH5bcySVzN4ULCCId4x-BkHln_wlWAN5PpLnLBwEhV_IMEVkI8_AckPHMRaYznUhvgJ_LfBYPVwnNIubcdToQY9R5fygHXy8YgMUveT55Ju0rqPSXeHb2OD1TY7qXWLB5G7RjzSB1oUuvf4Euvz51DiHBtzENWnL8hjgTQAVZrURG2aeeA-nW0XBcwA9n4tw", "provider_name": "aad", "user_claims": [{ "typ": "aud", "val": "b8d01464-c3fc-4573-a2c3-55ed9113620c" }, { "typ": "iss", "val": "https:\/\/login.microsoftonline.com\/72f988bf-86f1-41af-91ab-2d7cd011db47\/v2.0" }, { "typ": "iat", "val": "1615483502" }, { "typ": "nbf", "val": "1615483502" }, { "typ": "exp", "val": "1615487402" }, { "typ": "acct", "val": "0" }, { "typ": "aio", "val": "AXQAi\/8TAAAA4vYMqbMyE7lhaStQQ9klilkrZKAcaKVLGHTEEJtzc2TkU0Ku6+AqytGZzIjGgZqtona3f6z1H8HfCeNUjFKuNF8b8Ok51aXQqOPXWQ527DsJRphXKtRLmY5NHl6qeAr0JZcEqYKdNO0w57esvp4ZSA==" }, { "typ": "http:\/\/schemas.xmlsoap.org\/ws\/2005\/05\/identity\/claims\/emailaddress", "val": "v-maxsil@microsoft.com" }, { "typ": "name", "val": "Max Silbiger (MINDTREE LIMITED)" }, { "typ": "nonce", "val": "6d1bb4d6b44e4297b66aeba78707c419_20210311173501" }, { "typ": "http:\/\/schemas.microsoft.com\/identity\/claims\/objectidentifier", "val": "512d26c9-aeed-4dbd-a16f-398bcf0ec3fe" }, { "typ": "preferred_username", "val": "v-maxsil@microsoft.com" }, { "typ": "rh", "val": "0.ARoAv4j5cvGGr0GRqy180BHbR2QU0Lj8w3NFosNV7ZETYgwaANM." }, { "typ": "http:\/\/schemas.xmlsoap.org\/ws\/2005\/05\/identity\/claims\/nameidentifier", "val": "4e5XEzNghSxnmSUiY-5E9Hk-hgMswNrp_y9ozShy7hg" }, { "typ": "http:\/\/schemas.microsoft.com\/identity\/claims\/tenantid", "val": "72f988bf-86f1-41af-91ab-2d7cd011db47" }, { "typ": "uti", "val": "q3y7dfAyr06go0177hkuAA" }, { "typ": "ver", "val": "2.0" }], "user_id": "v-maxsil@microsoft.com" }]


var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, './uploads');
    },
    filename: function (req, file, callback) {
        callback(null, Date.now() + path.extname(file.originalname));
    }
});
var upload = multer({ storage: storage }).single('userFile');
var uploadMultiple = multer({ storage: storage }).array('userFile', 10);

module.exports = function (app, db) {

    var validationHandler = new ValidationHandler(db);
    var issueHandler = new IssueHandler(db);
    var bugHandler = new BugHandler(db);
    var caseHandler = new CaseHandler(db);
    var tenantHandler = new TenantHandler(db);
    var performanceHandler = new PerformanceHandler(db);
    var userHandler = new UserHandler(db);
    var feedbackHandler = new FeedbackHandler(db);
    var featureRequestHandler = new FeatureRequestHandler(db);
    var infoHandler = new InfoHandler(db);
    var analyticsHandler = new AnalyticsHandler(db);
    var featureHandler = new FeatureHandler(db);
    var userHandler = new UserHandler(db);

    app.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });


    // Auth
    if (process.env.ENV == "TEST") {
        app.route("/.auth/me")
            .get(function (req, res) {
                return res.json(LOCAL_TEST_TOKEN);
            });
    }

    // Front-end auth endpoints
    app.route("/login")
        .get(function (req, res) {
            return res.render("auth/login", {});
        });

    app.route("/tab-auth/simple-start")
        .get(function (req, res) {
            return res.render("auth/start", {});
        });

    app.route("/tab-auth/simple-end")
        .get(function (req, res) {
            return res.render("auth/end", {});
        });

    app.route('/')
        .get(validationHandler.getIndex);

    // Validation page
    app.route('/validations/:vId')
        .get(validationHandler.getValidation);

    // Bug triage endpoints
    app.route("/api/bugs/triage")
        .post(bugHandler.triageBug);

    app.route('/api/bugs/close')
        .post(bugHandler.closeBug)

    app.route('/api/bugs/bulkClose')
        .post(bugHandler.bulkCloseBugs);

    app.route('/api/bugs/comment')
        .post(bugHandler.addComment);

    app.route('/api/bugs/comments/:id')
        .get(bugHandler.getBugComments);

    app.route('/api/bugs/:bId')
        .get(bugHandler.getOneBug);

    app.route('/api/cases/:cId')
        .get(caseHandler.getOneCase)
        .post(caseHandler.addVote);

    app.route('/api/caseVotes/:cId/:user/:upDown')
        .get(caseHandler.getCaseVoteByUser);

    app.route('/api/caseVotes')
        .post(caseHandler.getCaseVotesByCustomer);

    // Endpoints for general feedback (validation-level)
    app.route('/api/feedback')
        .post(feedbackHandler.addFeedback);

    app.route('/api/feedback/public')
        .get(feedbackHandler.getPublicFeedback)

    app.route('/api/feedback/mine')
        .get(feedbackHandler.getFeedbackByUser);

    app.route('/api/feedback/:id')
        .put(feedbackHandler.modifyFeedback);

    app.route('/api/feedback/:id/comment')
        .post(feedbackHandler.commentOnFeedback);

    app.route("/api/feedback/:id/upvote")
        .post(feedbackHandler.upvoteFeedback);


    // Endpoints for individual case feedback
    app.route("/api/feedback/scenario/:id/comment")
        .post(caseHandler.commentOnCaseFeedback);

    app.route("/api/feedback/scenario/:id/upvote")
        .post(caseHandler.upvoteCaseFeedback);

    // TODO: Should be GET
    app.route('/api/feedback/scenario/public')
        .post(caseHandler.getCaseFeedbackPublic);

    // TODO: Should be GET
    app.route('/api/feedback/scenario/mine')
        .post(caseHandler.getCaseFeedbackByUser);

    app.route('/api/feedback/scenario/:id')
        .put(caseHandler.modifyCaseFeedback);


    // Endpoints for feature requests
    app.route('/api/featureRequests')
        .get(featureRequestHandler.getFeatureRequestsByUser)
        .post(featureRequestHandler.addFeatureRequest);

    app.route('/api/featureRequests/public')
        .get(featureRequestHandler.getPublicFeatureRequests);

    app.route('/api/featureRequests/:id')
        .put(featureRequestHandler.modifyFeatureRequest);

    // TODO: rename to "upvotes"
    app.route('/api/featureRequests/supports')
        .get(featureRequestHandler.getUserSupports);

    app.route('/api/featureRequests/upvote/:id')
        .post(featureRequestHandler.addSupport);


    app.route('/api/comments')
        .post(caseHandler.addComment);

    app.route('/api/upload')
        .post(function (req, res) {
            console.log("Posting to /api/upload");
            upload(req, res, function (err) {
                if (err) {
                    console.log(err);
                    return res.end("Error uploading file.");
                }
                if (req.file) {
                    console.log("File exists");
                    return res.send({ filename: req.file.filename })
                } else {
                    console.log("No files");
                    return res.status(200).send();
                }
            });
        });

    app.route('/api/upload/multiple')
        .post(function (req, res) {
            console.log("Posting to /api/upload/multiple");
            uploadMultiple(req, res, function (err) {
                if (err) {
                    console.log(err);
                    return res.end("Error uploading files.");
                }
                if (req.files) {
                    console.log("Files exist");
                    return res.send({ files: req.files });
                } else {
                    console.log("No files");
                    return res.status(200).send();
                }
            });
        });

    app.route('/api/validations')
        .post(validationHandler.updateValidation);

    // TODO: Route currently just used by tenant bugs tab. Should use csrf/GET instead
    app.route('/api/tenants')
        .get(enforceIdToken, tenantHandler.getTenant)
        .post(tenantHandler.getTenant);

    app.route('/api/users/deprovision')
        .post(enforceIdToken, userHandler.deprovisionUser);

    app.route('/api/users/:oid')
        .get(userHandler.getUserPrefs)
        .post(userHandler.setUserPrefs);

    app.route('/config')
        .get(validationHandler.getValidations);

    app.route('/issues-config')
        .get(issueHandler.getIssueConfig);

    app.route('/api/issues/:validationIds')
        .get(issueHandler.getIssues);

    app.route('/bugs-config')
        .get(bugHandler.getBugsConfig);

    app.route('/features-config')
        .get(featureHandler.getFeaturesConfig);

    app.route("/users-config")
        .get(userHandler.renderUsersConfig);

    app.route("/bug-report-config")
        .get(bugHandler.renderBugReportConfig);

    // Legacy
    app.route('/bugs/summary')
        .get(bugHandler.renderBugsSummary);

    app.route('/bugs/summary/:summaryId')
        .get(bugHandler.renderBugsSummary);

    app.route('/bugs/:tid')
        .get(bugHandler.getTenantBugsTemplate);

    app.route('/performance-config')
        .get(performanceHandler.getPerformanceConfig);

    app.route('/performance/:tid')
        .get(performanceHandler.renderPerformanceTemplate);

    app.route('/info')
        .get(infoHandler.getInfo);

    app.route('/features')
        .get(featureHandler.renderFeatures);

    app.route('/users')
        .get(enforceLoginTeams, userHandler.renderUsers);

    app.route('/bug-report')
        .get(enforceLoginTeams, bugHandler.renderBugReport);

    app.route('/api/tenantBugs/:tid')
        .get(bugHandler.getTenantBugs);

    app.route('/api/tenantBugs/:tid/:bugId')
        .get(bugHandler.getTenantBugs);

    app.route("/api/stats")
        .post(analyticsHandler.updateAnalytics);

    app.route("/api/pms/:email/taps")
        .get(userHandler.getPmTaps);

    app.route('/api/bugs/report')
        .post(enforceIdToken, bugHandler.submitBugReport);

    // Auth testing
    /*
    app.route("/silent-auth")
        .get(function (req, res) {
            return res.render("auth/silent-auth", {});
        });

    app.route("/silent-auth/silent-end")
        .get(function (req, res) {
            return res.render("auth/silent-auth-end", {});
        });

    app.route("/silent-auth/config")
        .get(function (req, res) {
            return res.render("auth/config", {});
        });

    app.route("/api/validateToken")
        .get(function (req, res) {
            let token = req.headers.authorization.replace("Bearer ", "");
            verifyJwt(token, function(err, verified) {
                if (err) {
                    console.log(err);
                    return res.status(403);
                }
                if (verified) {
                    console.log(verified);
                    return res.json(verified);
                } else {
                    console.log("Not verified");
                    return res.status(403);
                }
            })
        })
    */

    // Cron jobs
    // Every hour at x:15 - update Teams builds
    cron.schedule("15 * * * *", function () {
        console.log("Running cron - updating tenant bugs");
        // Not yet implemented
        //tenantHandler.updateTenantBugs();
    });

    app.use(function (req, res) {
        res.status(404).render('error', {
            message: "Page not found",
            status: "404"
        });
    });

};