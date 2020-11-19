'use strict';

var ObjectID = require('mongodb').ObjectID;
var request = require('request');

function analyticsHandler (dbParent) {

    // "db.collection is not a function"
    var db = dbParent.db("clementine");
    var analytics = db.collection('analytics');

    this.updateAnalytics = function (req, res) {
        console.log(req.body);

        let today = new Date().toLocaleDateString();

        // analytics collection
        // type: "link": url, visitCount
        // type: "user": email, role, visitCount, rating

        let query, update;

        if (req.body.type == "visit") {
            query = { type: "user", email: req.body.email }
            analytics.findOne(query, function (err, userDoc) {
                if (userDoc) {
                    update = { $inc: { "visits.all": 1, ["visits." + today]: 1 } };
                    analytics.updateOne(query, update, function (err, updateDoc) {
                        if (err) { console.log(err); }
                        return res.status(200).send();
                    });
                } else {
                    let newUser = {
                        type: "user",
                        email: req.body.email,
                        visits: {
                            'all': 1,
                        },
                        role: null,
                        dateCreated: new Date()
                    };

                    newUser.visits[today] = 1;

                    console.log(newUser);

                    analytics.insertOne(newUser, function (err, newUserDoc) {
                        if (err) { console.log(err); }

                        return res.status(200).send();
                    });
                }
            });
        } else if (req.body.type == "role") {
            query = { type: "user", email: req.body.email };
            update = { $set: { role: req.body.role } };
            console.log(query);
            console.log(update);
            analytics.updateOne(query, update, function (err, updateDoc) {
                if (err) { throw err; }
                return res.status(200).send();
            });

        } else if (req.body.type == "link") {
            query = { type: "link", url: req.body.url };
            analytics.findOne(query, function (err, linkDoc) {
                if (linkDoc) {
                    update = { $inc: { "clicks.all": 1, ["clicks." + today]: 1 } };

                    analytics.updateOne(query, update, function (err, updateDoc) {
                        if (err) { console.log(err); }

                        return res.status(200).send();
                    });
                } else {
                    let newLink = {
                        type: "link",
                        url: req.body.url,
                        clicks: {
                            'all': 1,
                        }
                    };
                    newLink.clicks[today] = 1;

                    analytics.insertOne(newLink, function (err, newLinkDoc) {
                        if (err) { console.log(err); }

                        return res.status(200).send();
                    });
                }
            });
        } else if (req.body.type == "rating") {
            query = { type: "user" };
            analytics.findOne(query, function (err, userDoc) {
                if (userDoc) {
                    update = {
                        $set: { rating: req.body.rating }
                    };

                    analytics.updateOne(query, update, function (err, updateDoc) {
                        if (err) {
                            console.log(err);
                        }
                        return res.status(200).send();
                    });
                }
            });
        }

        return res.status(200).send();
    }
}

module.exports = analyticsHandler;