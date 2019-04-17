'use strict';

//var ClickHandler = require(process.cwd() + '/app/controllers/clickHandler.server.js');
var ValidationHandler = require(process.cwd() + '/app/controllers/validationHandler.server.js');
var BugHandler = require(process.cwd() + '/app/controllers/bugHandler.server.js');
var CaseHandler = require(process.cwd() + '/app/controllers/caseHandler.server.js');

module.exports = function (app, db) {

    //var clickHandler = new ClickHandler(db);
    var validationHandler = new ValidationHandler(db);
    var bugHandler = new BugHandler(db);
    var caseHandler = new CaseHandler(db);

    app.route('/')
        .get(validationHandler.getIndex);

    app.route('/validations/:vId')
        .get(validationHandler.getValidation);

    //app.route('/api/validations')
    //    //.get(validationHandler.getValidations)
    //    .post(validationHandler.addValidation);

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

    app.route('/config')
        .get(validationHandler.getValidations);
};