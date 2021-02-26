'use strict';

(function () {
    $().ready(function () {
        microsoftTeams.initialize();

        // ADAL.js configuration
        let config = {
            clientId: "0dfd80d6-25d7-4670-a996-eb20888d9b94",
            redirectUri: window.location.origin + "/tab-auth/simple-end",       // This should be in the list of redirect uris for the AAD app
            cacheLocation: "localStorage",
            navigateToLoginRequestUrl: false,
        };

        let authContext = new AuthenticationContext(config);

        // Split the key-value pairs passed from Azure AD
        // getHashParameters is a helper function that parses the arguments sent
        // to the callback URL by Azure AD after the authorization call
        let hashParams = getHashParameters();
        if (hashParams["error"]) {
            // Authentication/authorization failed
            microsoftTeams.authentication.notifyFailure(hashParams["error"]);
        } else if (hashParams["access_token"]) {
            // Get the stored state parameter and compare with incoming state
            // This validates that the data is coming from Azure AD
            let expectedState = localStorage.getItem("simple.state");
            if (expectedState !== hashParams["state"]) {
                // State does not match, report error
                microsoftTeams.authentication.notifyFailure("StateDoesNotMatch");
            } else {
                // Success: return token information to the tab
                microsoftTeams.authentication.notifySuccess({
                    idToken: hashParams["id_token"],
                    accessToken: hashParams["access_token"],
                    tokenType: hashParams["token_type"],
                    expiresIn: hashParams["expires_in"]
                })
            }
        } else {
            // Unexpected condition: hash does not contain error or access_token parameter

            // EasyAuth does not return these params in the URL.
            // Let's try just assuming it was correct...?
            console.log(hashParams);
            microsoftTeams.authentication.notifySuccess({
                idToken: null,
                accessToken: null,
                tokenType: null,
                expiresIn: null
            });

            // TODO: Getting this currently. Let's see why.
            // Probably going through EasyAuth doesn't return an access token? Let's see if we can use some other success message instead
            //microsoftTeams.authentication.notifyFailure("UnexpectedFailure");
        }

        // Parse hash parameters into key-value pairs
        function getHashParameters() {
            let hashParams = {};
            location.hash.substr(1).split("&").forEach(function (item) {
                let s = item.split("="),
                    k = s[0],
                    v = s[1] && decodeURIComponent(s[1]);
                hashParams[k] = v;
            });
            return hashParams;
        }

    });

})();