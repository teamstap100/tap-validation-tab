 
// Config object to be passed to Msal on creation.
// For a full list of msal.js configuration parameters, 
// visit https://azuread.github.io/microsoft-authentication-library-for-js/docs/msal/modules/_authenticationparameters_.html
const adalConfig = {
    clientId: "b8d01464-c3fc-4573-a2c3-55ed9113620c",
    authority: "https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47",
    redirectUri: window.location.origin + "/silent-auth/silent-end",
    cacheLocation: "localStorage",
    navigateToLoginRequestUrl: false,
  }
  
// Add here scopes for id token to be used at MS Identity Platform endpoints.
/*
const msaLoginRequest = {
    scopes: ["openid", "profile", "User.Read"]
};

// Add here scopes for access token to be used at MS Graph API endpoints.
const tokenRequest = {
    scopes: ["User.Read"]
};
*/