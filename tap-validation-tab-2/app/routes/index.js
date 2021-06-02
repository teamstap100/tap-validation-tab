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
//var InfoHandler = require(process.cwd() + "/app/controllers/tap100-app/infoHandler.server.js");
var AnalyticsHandler = require(process.cwd() + "/app/controllers/analyticsHandler.server.js");
var FeatureHandler = require(process.cwd() + "/app/controllers/features/featureHandler.server.js");
var UserHandler = require(process.cwd() + "/app/controllers/users/userHandler.server.js");

var multer = require('multer');
var path = require('path');
const cron = require('node-cron');

const { enforceLoginTeams, enforceIdToken, test_user, } = require(process.cwd() + "/app/routes/helpers.js");

const LOCAL_TEST_TOKEN = [{}]


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
    //var infoHandler = new InfoHandler(db);
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

    app.route('/validations/:vId/remove')
        .get(validationHandler.getRemovalPage);

    // Bug triage endpoints
    app.route("/api/bugs/triage")
        .post(enforceIdToken, bugHandler.triageBug);

    app.route('/api/bugs/close')
        .post(enforceIdToken, bugHandler.closeBug)

    app.route('/api/bugs/bulkClose')
        .post(enforceIdToken, bugHandler.bulkCloseBugs);

    app.route('/api/bugs/comment')
        .post(enforceIdToken, bugHandler.addComment);

    app.route('/api/bugs/comments/:id')
        .get(enforceIdToken, bugHandler.getBugComments);

    app.route('/api/bugs/:bId')
        .get(enforceIdToken, bugHandler.getOneBug);

    app.route('/api/cases/:cId')
        .get(caseHandler.getOneCase)
        .post(caseHandler.addVote);

    app.route('/api/caseVotes/:cId/:user/:upDown')
        .get(caseHandler.getCaseVoteByUser);

    app.route('/api/caseVotes')
        .get(caseHandler.getCaseVotesByCustomer);

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

    app.route('/api/tabLocations')
        .post(analyticsHandler.updateValidationTabLocations);

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

    app.route('/bugs/sevA')
        .get(bugHandler.renderSevABugs);

    app.route('/bugs/:tid')
        .get(bugHandler.getTenantBugsTemplate);

    app.route('/performance-config')
        .get(performanceHandler.getPerformanceConfig);

    app.route('/performance/:tid')
        .get(performanceHandler.renderPerformanceTemplate);

    // app.route('/info')
    //     .get(infoHandler.getInfo);

    app.route('/features')
        .get(featureHandler.renderFeatures);

    // removed enforceLoginTeams
    app.route('/users')
        .get(userHandler.renderUsers);

    app.route('/bug-report')
        .get(enforceLoginTeams, bugHandler.renderBugReport);

    app.route('/api/tenantBugs/:tid')
        .get(enforceIdToken, bugHandler.getTenantBugs);

    app.route('/api/tenantBugs/:tid/:bugId')
        .get(enforceIdToken, bugHandler.getTenantBugs);

    app.route("/api/pms/:email/taps")
        .get(userHandler.getPmTaps);

    app.route('/api/bugs/report')
        .post(enforceIdToken, bugHandler.submitBugReport);

    //app.route('/api/validations/updateTabUrlFields')
    //    .get(validationHandler.updateTabUrlFields);

    app.use(function (req, res) {
        res.status(404).render('error', {
            message: "Page not found",
            status: "404"
        });
    });

};