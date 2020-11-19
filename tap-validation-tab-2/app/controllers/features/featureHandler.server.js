'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');

function featureHandler(dbParent) {
    var db = dbParent.db("clementine");

    //var features = db.collection("tapFeatures");
    var validations = db.collection("validations");
    var pms = db.collection("pms");

    let featureProjection = {
        _id: 1,
        "PBI": 1,
        owner: 1
    };

    // TODO: Now that we're getting validations, this should be moved to validationHandler

    this.renderFeatures = function (req, res) {

        validations.find({
            $or: [
                {
                    "PBI.Validation Required": "Yes",
                },
                {
                    "PBI.Validation\nRequired": "Yes"
                }
            ],
            "PBI.Ring4": { $in: ["Not Enabled", "Preview"] }
        }).project(featureProjection).toArray(function (err, featuresInTap) {
            console.log(featuresInTap.length);
            pms.find({ tap: "Teams" }).toArray(function (err, pmDocs) {
                featuresInTap.forEach(function (feature) {
                    feature.owner = pmDocs.find(pm => pm.email == feature.owner).fullName;
                })
                return res.render('features/features', {
                    features: featuresInTap
                });
            })

        });

    };

    this.getFeaturesConfig = function (req, res) {
        return res.render('features/features_config');
    }

};

module.exports = featureHandler;