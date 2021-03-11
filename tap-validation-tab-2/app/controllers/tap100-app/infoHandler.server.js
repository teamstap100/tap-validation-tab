'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');

function infoHandler (dbParent) {

    // "db.collection is not a function"
    var db = dbParent.db("clementine");
    var roles = db.collection('roles');

    // Just a static list for now
    var phases = [];


    this.getInfo = function (req, res) {
        var alphaSort = { name: 1 };

        roles.find({}).sort(alphaSort).toArray(function (err, roleDocs) {

            let phaseDocs = [];
            phases.forEach(function (phase) {
                phaseDocs.push({
                    name: phase[0],
                    id: phase[1]
                })
            });

            res.render('tap100-app/info', {
                roles: roleDocs,
                phases: phaseDocs,
            });
        })
    };

  };

module.exports = infoHandler;