'use strict';

var ObjectID = require('mongodb').ObjectID;

module.exports = {
    ADO_API_BASE: "https://dev.azure.com/{org}/{project}/_apis/wit/",

    safeOid: function(id) {
        let safeId;
        if (isNaN(id)) {
            safeId = ObjectID(id);
        } else {
            try {
                safeId = parseInt(id);
            } catch (e) {
                safeId = id;
            }
        }
        return safeId;
    },

    patToAuth: function (pat) {
        let buf = new Buffer(":" + pat);
        let base64Data = buf.toString("base64");
        return "Basic " + base64Data;
    }
};