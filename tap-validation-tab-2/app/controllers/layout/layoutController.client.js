$(document).ready(function () {
    microsoftTeams.initialize();
    try {
        microsoftTeams.appInitialization.notifySuccess();
    } catch (e) {
        console.log("Loading indicator not set up in this app version");
    }
});