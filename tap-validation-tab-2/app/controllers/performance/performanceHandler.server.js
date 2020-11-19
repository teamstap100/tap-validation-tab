'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');

function performanceHandler (dbParent) {

    // "db.collection is not a function"
    var db = dbParent.db("clementine");
    var tenants = db.collection('tenants');
    var validations = db.collection('validations');

    this.renderPerformanceTemplate = function (req, res) {
        let tid = req.params.tid;

        validations.find().toArray(function (err, valDocs) {
            tenants.findOne({ tid: tid }, function (err, tenantDoc) {
                console.log(tenantDoc);
                res.render('performance/performance', {
                    tenant: tenantDoc,
                    validations: valDocs
                });
            });
        });


    }

    this.getPerformanceConfig = function (req, res) {

        var alphaSort = { name: 1 };

        var activeTenants = {
            status: "TAP"
        }

        tenants.find(activeTenants).sort(alphaSort).toArray(function (err, tenantDocs) {
            res.render('performance/performanceConfig', {
                tenants: tenantDocs
            });
        })
    };

  };

module.exports = performanceHandler;