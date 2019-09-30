'use strict';

//var ClickHandler = require(process.cwd() + '/app/controllers/clickHandler.server.js');
var ValidationHandler = require(process.cwd() + '/app/controllers/validationHandler.server.js');
var BugHandler = require(process.cwd() + '/app/controllers/bugHandler.server.js');
var CaseHandler = require(process.cwd() + '/app/controllers/caseHandler.server.js');
var IssueHandler = require(process.cwd() + '/app/controllers/issueHandler.server.js');
var TenantHandler = require(process.cwd() + '/app/controllers/tenantHandler.server.js');

module.exports = function (app, db) {

    var validationHandler = new ValidationHandler(db);
    var issueHandler = new IssueHandler(db);
    var bugHandler = new BugHandler(db);
    var caseHandler = new CaseHandler(db);
    var tenantHandler = new TenantHandler(db);

    app.route('/')
        .get(validationHandler.getIndex);

    app.route('/validations/:vId')
        .get(validationHandler.getValidation);

    app.route('/api/bugs')
        .get(bugHandler.getBug)
        .post(bugHandler.addBug);

    app.route('/api/bugs/:bId')
        .get(bugHandler.getOneBug)
        .post(bugHandler.addVote);

    app.route('/api/cases/:cId')
        .get(caseHandler.getOneCase)
        .post(caseHandler.addVote);

    app.route('/api/comments')
        .post(caseHandler.addComment);

    app.route('/api/validations')
        .post(validationHandler.updateValidation);

    app.route('/api/tenants')
        .post(tenantHandler.getTenant);

    app.route('/config')
        .get(validationHandler.getValidations);

    app.route('/issues-config')
        .get(issueHandler.getIssueConfig);

    app.route('/issues/:validationIds')
        .get(issueHandler.getIssue);


};