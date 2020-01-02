'use strict';

var ObjectID = require('mongodb').ObjectID;

function tenantHandler(dbParent) {

    //var clicks = db.collection('clicks');
    // "db.collection is not a function"
    var db = dbParent.db("clementine");
    var validations = db.collection('validations');

    var tenants = db.collection('tenants');

    function cleanEmail(email) {
        console.log("Cleaning email");
        console.log(email);
        email = email.toLowerCase();
        console.log(email);
        email = email.replace("#ext#@microsoft.onmicrosoft.com", "");
        console.log(email);
        if (email.includes("@")) {
            return email;

        } else if (email.includes("_")) {
            console.log("Going the underscore route");
            var underscoreParts = email.split("_");
            var domain = underscoreParts.pop();
            var tenantString = domain.split(".")[0];

            if (underscoreParts.length > 1) {
                email = underscoreParts.join("_") + "@" + domain;
            } else {
                email = underscoreParts[0] + "@" + domain;
            }
        }
        return email;
    }

    function getDomain(email) {
        var domain = "?";
        if (email.includes("@")) {
            var atParts = email.split("@");
            domain = atParts.pop();
            var tenantString = domain.split(".")[0];

        } else if (email.includes("_")) {
            console.log("Going the underscore route");
            var underscoreParts = email.split("_");
            domain = underscoreParts.pop();
            var tenantString = domain.split(".")[0];

            if (underscoreParts.length > 1) {
                email = underscoreParts.join("_") + "@" + domain;
            } else {
                email = underscoreParts[0] + "@" + domain;
            }
        }
        return domain.toLowerCase();
    }

    // db used to return the db, now it returns the parent in mongo 3.0.0.
    // So, need to point it to the real db each time.

    this.getTenant = function (req, res) {
        console.log("Calling getTenant on " + req.body.email);
        console.log("Full req body is: " + JSON.stringify(req.body, null, 2));
        //if (req.body.email == null) {
        //    res.json({});
        //    return;
        //}
        var email = req.body.email;

        var clientVoteString = cleanEmail(email);
        var domain = getDomain(clientVoteString);

        if (clientVoteString.includes("undefined")) {
            clientVoteString = email;
            tenantString = clientVoteString.split("@")[1].split(".")[0];
        }
        // TODO: Use a projection to return just name/TID
        tenants.findOne({ domains: domain }, function (err, tenantDoc) {
            res.json(tenantDoc);
        });
    };
};

module.exports = tenantHandler;