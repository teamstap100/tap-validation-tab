'use strict';

(function () {
    $().ready(function () {
        microsoftTeams.initialize();

        var authTokenRequest = {
            successCallback: function (result) {
                //console.log("Success: " + result);
                console.log("Able to get token");
                //console.log(result);
            },
            failureCallback: function (error) {
                //console.log("Failure: " + error);
                console.log("Error getting token");
                console.log(error);
            }
        };
        microsoftTeams.authentication.getAuthToken(authTokenRequest);
    });

})();