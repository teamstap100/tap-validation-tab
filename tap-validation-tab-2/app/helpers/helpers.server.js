'use strict';

var ObjectID = require('mongodb').ObjectID;

module.exports = {
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
    }
};