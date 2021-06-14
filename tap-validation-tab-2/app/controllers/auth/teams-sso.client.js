'use strict';

(function () {
    $().ready(function () {
        microsoftTeams.initialize();

        var authTokenRequest = {
            successCallback: function (result) {
                //console.log("Success: " + result);
                console.log("Able to get token");
                $('#version').text("v1.0.2");
                //console.log(result);
            },
            failureCallback: function (error) {
                //console.log("Failure: " + error);
                console.log("Error getting token");
                $('#version').text("v1.0.1");

                console.log(error);
            }
        };
        microsoftTeams.authentication.getAuthToken(authTokenRequest);
    });

})();