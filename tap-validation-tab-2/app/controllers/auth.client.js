'use strict';

(function () {
    $().ready(function () {
        console.log("Here's the script");
        microsoftTeams.initialize();

        // ADAL.js configuration
        let config = {
            clientId: "1c02f434-dd04-4d3e-a7a5-2430fdc9ce09",
            redirectUri: window.location.origin + "/silent-auth/silent-end",       // This should be in the list of redirect uris for the AAD app
            cacheLocation: "localStorage",
            navigateToLoginRequestUrl: false,
        };

        let upn = undefined;
        microsoftTeams.getContext(function (context) {
            upn = context.upn;
            loadData(upn);
        });

        // Loads data for the given user
        function loadData(upn) {
            // Setup extra query parameters for ADAL
            // - openid and profile scope adds profile information to the id_token
            // - login_hint provides the expected user name
            if (upn) {
                config.extraQueryParameters = "scope=openid+profile&login_hint=" + encodeURIComponent(upn);
            } else {
                config.extraQueryParameters = "scope=openid+profile";
            }

            let authContext = new AuthenticationContext(config);

            // See if there's a cached user and it matches the expected user
            let user = authContext.getCachedUser();
            if (user) {
                if (user.userName !== upn) {
                    // User doesn't match, clear the cache
                    authContext.clearCache();
                }
            }

            // Get the id token (which is the access token for resource = clientId)
            let token = authContext.getCachedToken(config.clientId);
            if (token) {
                showProfileInformation(token);
            } else {
                // No token, or token is expired
                authContext._renewIdToken(function (err, idToken) {
                    if (err) {
                        console.log("Renewal failed: " + err);

                        // Failed to get the token silently; show the login button
                        $("#btnLogin").css({ display: "" });

                        // You could attempt to launch the login popup here, but in browsers this could be blocked by
                        // a popup blocker, in which case the login attempt will fail with the reason FailedToOpenWindow.
                    } else {
                        showProfileInformation(idToken);
                    }
                });
            }
        }

        // Login to Azure AD
        function login() {
            $("#divError").text("").css({ display: "none" });
            $("#divProfile").css({ display: "none" });

            microsoftTeams.authentication.authenticate({
                url: window.location.origin + "/tab-auth/silent-start",
                width: 600,
                height: 535,
                successCallback: function (result) {
                    // AuthenticationContext is a singleton
                    let authContext = new AuthenticationContext();
                    let idToken = authContext.getCachedToken(config.clientId);
                    if (idToken) {
                        showProfileInformation(idToken);
                    } else {
                        console.error("Error getting cached id token. This should never happen.");
                        // At this point we have to get the user involved, so show the login button
                        $("#btnLogin").css({ display: "" });
                    };
                },
                failureCallback: function (reason) {
                    console.log("Login failed: " + reason);
                    if (reason === "CancelledByUser" || reason === "FailedToOpenWindow") {
                        console.log("Login was blocked by popup blocker or canceled by user.");
                    }
                    // At this point we have to get the user involved, so show the login button
                    $("#btnLogin").css({ display: "" });

                    $("#divError").text(reason).css({ display: "" });
                    $("#divProfile").css({ display: "none" });
                }
            });
        }

        // Get the user's profile information from the id token
        function showProfileInformation(idToken) {
            $.ajax({
                url: window.location.origin + "/api/validateToken",
                beforeSend: function (request) {
                    request.setRequestHeader("Authorization", "Bearer " + idToken);
                },
                success: function (token) {
                    console.log(token);
                    $("#profileDisplayName").text(token.name);
                    $("#profileUpn").text(token.upn);
                    $("#profileObjectId").text(token.oid);
                    $("#divProfile").css({ display: "" });
                    $("#divError").css({ display: "none" });
                },
                error: function (xhr, textStatus, errorThrown) {
                    console.log("textStatus: " + textStatus + ", errorThrown:" + errorThrown);
                    $("#divError").text(errorThrown).css({ display: "" });
                    $("#divProfile").css({ display: "none" });
                },
            });
        }
    });

})();