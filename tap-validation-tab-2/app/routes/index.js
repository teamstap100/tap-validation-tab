'use strict';

//var ClickHandler = require(process.cwd() + '/app/controllers/clickHandler.server.js');
var ValidationHandler = require(process.cwd() + '/app/controllers/validationHandler.server.js');
var BugHandler = require(process.cwd() + '/app/controllers/bugHandler.server.js');
var CaseHandler = require(process.cwd() + '/app/controllers/caseHandler.server.js');
var IssueHandler = require(process.cwd() + '/app/controllers/issueHandler.server.js');
var TenantHandler = require(process.cwd() + '/app/controllers/tenantHandler.server.js');
var PerformanceHandler = require(process.cwd() + '/app/controllers/performanceHandler.server.js');
var UserHandler = require(process.cwd() + '/app/controllers/userHandler.server.js');

var multer = require('multer');
var path = require('path');

var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, './uploads');
    },
    filename: function (req, file, callback) {
        //callback(null, file.fieldname + '-' + Date.now());
        callback(null, Date.now() + path.extname(file.originalname));
    }
});
var upload = multer({ storage: storage }).single('userPhoto');

module.exports = function (app, db) {

    var validationHandler = new ValidationHandler(db);
    var issueHandler = new IssueHandler(db);
    var bugHandler = new BugHandler(db);
    var caseHandler = new CaseHandler(db);
    var tenantHandler = new TenantHandler(db);
    var performanceHandler = new PerformanceHandler(db);
    var userHandler = new UserHandler(db);

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
        .get(bugHandler.getBug)
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
        .get(bugHandler.getOneBug)
        .post(bugHandler.addVote);

    app.route('/api/cases/:cId')
        .get(caseHandler.getOneCase)
        .post(caseHandler.addVote);

    app.route('/api/caseVotes')
        .post(caseHandler.getCaseVotesByCustomer);

    app.route('/api/feedback')
        .post(validationHandler.getFeedbackByUser);

    app.route('/api/feedback/:id')
        .put(validationHandler.modifyFeedback);

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
        .post(validationHandler.addFeedback);



    app.route('/api/tenants')
        .post(tenantHandler.getTenant);

    app.route('/api/users/:oid')
        .get(userHandler.getUserPrefs)
        .post(userHandler.setUserPrefs);

    app.route('/config')
        .get(validationHandler.getValidations);

    app.route('/issues-config')
        .get(issueHandler.getIssueConfig);

    app.route('/issues/:validationIds')
        .get(issueHandler.getIssue);

    app.route('/bugs-config')
        .get(bugHandler.getBugsConfig);

    app.route('/bugs/:tid')
        .get(bugHandler.getTenantBugsTemplate);

    app.route('/performance-config')
        .get(performanceHandler.getPerformanceConfig);

    app.route('/performance/:tid')
        .get(performanceHandler.renderPerformanceTemplate);

    app.route('/api/tenantBugs/:tid')
        .get(bugHandler.getTenantBugs);

};