'use strict';

var ObjectID = require('mongodb').ObjectID;

const TEST_USER = {
    aud: '5b17716e-e0a6-4604-868f-9c781998021f',
    iss: 'https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47/v2.0',
    iat: 1615480461,
    nbf: 1615480461,
    exp: 1615484361,
    acct: 0,
    email: 'tim@test.com',
    name: 'Max Silbiger (MINDTREE LIMITED)',
    oid: '512d26c9-aeed-4dbd-a16f-398bcf0ec3fe',
    preferred_username: 'tim@test.com',
    tid: '72f988bf-86f1-41af-91ab-2d7cd011db47',
    ver: '2.0'
}

function tenantHandler(dbParent) {

    // Remove duplicates from a merged array
    Array.prototype.unique = function () {
        var a = this.concat();
        for (var i = 0; i < a.length; ++i) {
            for (var j = i + 1; j < a.length; ++j) {
                if (a[i] === a[j])
                    a.splice(j--, 1);
            }
        }

        return a;
    };

    //var clicks = db.collection('clicks');
    // "db.collection is not a function"
    var db = dbParent.db("clementine");
    var validations = db.collection('validations');

    var tenants = db.collection('tenants');

    // TODO: This looks a little different from the other cleanEmail in helpers
    function cleanEmail(email) {
        console.log("Cleaning email");
        console.log(email);

        // Deal with undefined email
        if (!email) {
            return email;
        }

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
        if (!email) {
            return domain;
        }

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
        console.log(domain);

        if (domain.includes(".microsoft.com")) {
            domain = "microsoft.com";
        }

        return domain.toLowerCase();
    }

    // db used to return the db, now it returns the parent in mongo 3.0.0.
    // So, need to point it to the real db each time.

    function getAllUsers(tid, callback) {
        let tenantProjection = {
            name: 1,
            tid: 1,
            parent: 1,
            _id: 0,
            itAdmins: 1,  // Not sure if used. Gets used in the Admin equivalent (by TIDToTenantName azure function) for sure
            itAdminIds: 1, // Used in Admin equivalent
            users: 1,
        }

        let allUsers = [];

        tenants.find({ parent: tid }, { projection: tenantProjection }, function (err, siblingDocs) {
            console.log("Got siblings");
            siblingDocs.forEach(function (siblingDoc) {
                if (siblingDoc.users) {
                    console.log(siblingDoc.tid, " has " + siblingDoc.users.length + " users");
                    allUsers = allUsers.concat(siblingDoc.users).unique();
                }
            });
            tenants.findOne({ tid: tid }, { projection: tenantProjection }, function (err, tenantDoc) {
                console.log("Got this tenant");
                if (tenantDoc.users) {
                    console.log(tenantDoc.tid, " has " + tenantDoc.users.length + " users");

                }

                allUsers = allUsers.concat(tenantDoc.users).unique();
                if (tenantDoc.parent) {
                    console.log("Getting parent");
                    tenants.findOne({ tid: tenantDoc.parent }, { projection: tenantProjection }, function (err, parentTenantDoc) {
                        if (parentTenantDoc.users) {
                            console.log(parentTenantDoc.tid, " has " + parentTenantDoc.users.length + " users");
                        }

                        allUsers = allUsers.concat(parentTenantDoc.users).unique();
                        return callback(null, allUsers);
                    });
                }
                return callback(null, allUsers);
            });
        });
    }

    this.getTenant = function (req, res) {
        console.log("Called getTenant");
        let tenantProjection = {
            name: 1,
            tid: 1,
            parent: 1,
            _id: 0,
            itAdmins: 1,  // Not sure if used. Gets used in the Admin equivalent (by TIDToTenantName azure function) for sure
            itAdminIds: 1, // Used in Admin equivalent
            users: 1,
        }

        console.log("Calling getTenant on " + req.body.email);
        console.log("Full req body is: " + JSON.stringify(req.body, null, 2));
        //if (req.body.email == null) {
        //    res.json({});
        //    return;
        //}

        if (process.env.ENV == "TEST") {
            console.log("Using test-user in getTenant");
            req.user = TEST_USER;
        }

        var email = req.body.email;
        if (req.user) {
            console.log("Using user in header");
            console.log(req.user);
            email = req.user.email; // or maybe preferred_username?
        }
            
        if (email == null) {
            email = req.body.backup_context.upn;
        }

        var clientVoteString = cleanEmail(email);
        var domain = getDomain(clientVoteString);

        if (!clientVoteString) {
            clientVoteString = email;
            tenantString = clientVoteString.split("@")[1].split(".")[0];
        }
 
        tenants.findOne({ domains: domain }, { projection: tenantProjection }, function (err, tenantDoc) {
            console.log(tenantDoc);

            if (tenantDoc) {
                if (tenantDoc.parent) {
                    console.log("This tenant has a parent");
                    tenants.findOne({ tid: tenantDoc.parent }, { projection: tenantProjection }, function (err, parentTenantDoc) {
                        getAllUsers(parentTenantDoc.tid, function (err, allUsers) {
                            parentTenantDoc.users = allUsers;
                            return res.json(parentTenantDoc);
                        });
                    });
                } else {
                    getAllUsers(tenantDoc.tid, function (err, allUsers) {
                        tenantDoc.users = allUsers;
                        return res.json(tenantDoc);
                    });
                }
            } else {
                res.json({ name: '?', tid: '?', itAdmins: "", itAdminIds: [], users: []});
            }

        });
    };
};

module.exports = tenantHandler;