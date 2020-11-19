'use strict';

(function () {
    $().ready(function () {
        microsoftTeams.initialize();

        // ADAL.js configuration
        let config = {
            clientId: "1c02f434-dd04-4d3e-a7a5-2430fdc9ce09",
            redirectUri: window.location.origin + "/silent-auth/silent-end",       // This should be in the list of redirect uris for the AAD app
            cacheLocation: "localStorage",
            navigateToLoginRequestUrl: false,
        };

        let authContext = new AuthenticationContext(config);

        if (authContext.isCallback(window.location.hash)) {
            authContext.handleWindowCallback(window.location.hash);
            // Only call notifySuccess or notifyFailure if this page is in the authentication popup
            if (window.opener) {
                if (authContext.getCachedUser()) {
                    microsoftTeams.authentication.notifySuccess();
                } else {
                    microsoftTeams.authentication.notifyFailure(authContext.getLoginError());
                }
            }
        }

    });

})();