'use strict';

//var ClickHandler = require(process.cwd() + '/app/controllers/clickHandler.server.js');
var ValidationHandler = require(process.cwd() + '/app/controllers/validation/validationHandler.server.js');
var BugHandler = require(process.cwd() + '/app/controllers/bugs/bugHandler.server.js');
var CaseHandler = require(process.cwd() + '/app/controllers/validation/caseHandler.server.js');
var IssueHandler = require(process.cwd() + '/app/controllers/knownIssues/issueHandler.server.js');
var TenantHandler = require(process.cwd() + '/app/controllers/tenantHandler.server.js');
var PerformanceHandler = require(process.cwd() + '/app/controllers/performance/performanceHandler.server.js');
var UserHandler = require(process.cwd() + '/app/controllers/userHandler.server.js');
var FeedbackHandler = require(process.cwd() + '/app/controllers/validation/feedbackHandler.server.js');
var FeatureRequestHandler = require(process.cwd() + "/app/controllers/validation/featureRequestHandler.server.js");
var InfoHandler = require(process.cwd() + "/app/controllers/tap100-app/infoHandler.server.js");
var AnalyticsHandler = require(process.cwd() + "/app/controllers/analyticsHandler.server.js");
var FeatureHandler = require(process.cwd() + "/app/controllers/features/featureHandler.server.js");

var multer = require('multer');
var path = require('path');
const cron = require('node-cron');
const jwt = require('jsonwebtoken');
const request = require('request');

var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, './uploads');
    },
    filename: function (req, file, callback) {
        callback(null, Date.now() + path.extname(file.originalname));
    }
});
var upload = multer({ storage: storage }).single('userFile');

function ensureAuthenticated(req, res, next) {
    console.log("user: ");
    console.log(req.user);
    console.log("Is authenticated: ");
    console.log(req.isAuthenticated());

    if (req.isAuthenticated()) { return next(); }
    else {
        if (req.session) {
            req.session.returnTo = req.originalUrl;
            console.log("Set req.session.returnTo");
        } else {
            console.log("No session");
        }
        res.redirect('/login');
    }
}

function verifyJwt(token, callback) {
    // Validating the token requires these steps. See this blog:
    // https://stevelathrop.net/securing-a-node-js-rest-api-with-azure-ad-jwt-bearer-tokens/

    // First, get the right 'kid' value from the decoded token
    var decoded = jwt.decode(token, { complete: true });
    var kid = decoded.header.kid;

    // Determine the correct public key to verify the MSA token
    var keyUrl = "https://login.microsoftonline.com/common/discovery/v2.0/keys";

    request.get(keyUrl, function (err, resp, body) {
        var keys = JSON.parse(body).keys;
        var thisKey = keys.find(key => {
            return key.kid == kid
        });

        var publicKey = '-----BEGIN CERTIFICATE-----\n' + thisKey.x5c[0] + '\n-----END CERTIFICATE-----';

        jwt.verify(token, publicKey, { audience: CLIENT_ID, issuer: ISSUER, }, function (err, verified) {
            return callback(err, verified);
        });
    });
}

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

    app.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    app.route('/')
        .get(validationHandler.getIndex);

    app.route('/validations/:vId')
        .get(validationHandler.getValidation);

    // TODO: Determine if this gets used
    app.route('/api/bugs')
        //.get(bugHandler.getBug)
        .post(bugHandler.addBug);

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
        //.post(bugHandler.addVote);

    app.route('/api/cases/:cId')
        .get(caseHandler.getOneCase)
        .post(caseHandler.addVote);

    app.route('/api/caseVotes/:cId/:user/:upDown')
        .get(caseHandler.getCaseVoteByUser);

    app.route('/api/caseVotes')
        .post(caseHandler.getCaseVotesByCustomer);

    // New caseVotes calls for feedback-style tables
    /*
    app.route('/api/caseVotes/public')
        .post(caseHandler.getPublicVotes);

    app.route('/api/caseVotes/:caseId/:userId')
        .post(caseHandler.getCaseVotesOnlyByCustomer);
    */

    app.route('/api/feedback')
        .post(feedbackHandler.getFeedbackByUser);

    app.route('/api/feedback/public')
        .post(feedbackHandler.getPublicFeedback)

    app.route('/api/feedback/:id')
        .put(feedbackHandler.modifyFeedback);

    app.route("/api/feedback/:id/comment")
        .post(caseHandler.commentOnCaseFeedback);

    app.route("/api/feedback/:id/upvote")
        .post(caseHandler.upvoteCaseFeedback);

    app.route('/api/feedback/scenario/public')
        .post(caseHandler.getCaseFeedbackPublic);

    app.route('/api/feedback/scenario/mine')
        .post(caseHandler.getCaseFeedbackByUser);

    app.route('/api/feedback/scenario/:id')
        .put(caseHandler.modifyCaseFeedback);



    app.route('/api/featureRequests')
        .post(featureRequestHandler.getFeatureRequestsByUser);

    app.route('/api/featureRequests/public')
        .post(featureRequestHandler.getPublicFeatureRequests);

    app.route('/api/featureRequests/:id')
        .put(featureRequestHandler.modifyFeatureRequest);

    app.route('/api/featureRequests/supports')
        .post(featureRequestHandler.getUserSupports);

    app.route('/api/featureRequests/support/:id')
        .post(featureRequestHandler.addSupport);

    app.route('/api/comments')
        .post(caseHandler.addComment);

    app.route('/api/upload')
        .post(function (req, res) {
            upload(req, res, function (err) {
                if (err) {
                    console.log(err);
                    return res.end("Error uploading file.");
                }
                if (req.file) {
                    return res.send({ filename: req.file.filename })
                } else {
                    return res.status(200).send();
                }
            });
        });

    app.route('/api/validations')
        .post(validationHandler.updateValidation);

    app.route('/api/validations/feedback')
        .post(feedbackHandler.addFeedback);

    app.route('/api/validations/featureRequests')
        .post(featureRequestHandler.addFeatureRequest);

    // TODO: Route currently just used by tenant bugs tab. Should use csrf/GET instead
    app.route('/api/tenants')
        .post(tenantHandler.getTenant);

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

    app.route('/api/tenantBugs/:tid')
        .get(bugHandler.getTenantBugs);

    app.route('/api/tenantBugs/:tid/:bugId')
        .get(bugHandler.getTenantBugs);

    app.route("/api/stats")
        .post(analyticsHandler.updateAnalytics);

    app.route("/api/pms/:email/taps")
        .get(userHandler.getPmTaps);

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