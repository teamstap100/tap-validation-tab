'use strict';

(function () {

   // PRODUCTION
    //var contentUrlBase = "https://tap-validation-tab.azurewebsites.net/bugs/";

    // TESTING
    //var contentUrlBase = "https://07527890.ngrok.io/bugs/";

    var contentUrlBase = window.location.href.replace("features-config", "features");

  function setValid() {
    console.log("onClick called");
    microsoftTeams.settings.setValidityState(true);
  }

  microsoftTeams.initialize();
  microsoftTeams.settings.registerOnSaveHandler(function(saveEvent){
      console.log("calling registerOnSaveHandler");

      var settings = {
          entityId: "Features",
          contentUrl: contentUrlBase,
          suggestedDisplayName: "Features",
      }

      console.log(settings);
      microsoftTeams.settings.setSettings(settings);

      saveEvent.notifySuccess();
  });

})();