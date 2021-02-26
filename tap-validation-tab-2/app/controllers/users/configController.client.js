'use strict';

(function () {

    var contentUrlBase = window.location.href.replace("users-config", "users");

  function setValid() {
    console.log("onClick called");
    microsoftTeams.settings.setValidityState(true);
  }

  microsoftTeams.initialize();
  microsoftTeams.settings.registerOnSaveHandler(function(saveEvent){
      console.log("calling registerOnSaveHandler");
      console.log(contentUrlBase);

      var settings = {
          entityId: "View TAP Users",
          contentUrl: contentUrlBase,
          suggestedDisplayName: "Features",
      }

      console.log(settings);
      microsoftTeams.settings.setSettings(settings);

      saveEvent.notifySuccess();
  });

})();