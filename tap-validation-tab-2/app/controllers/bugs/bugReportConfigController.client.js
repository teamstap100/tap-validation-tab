'use strict';

(function () {

    var contentUrlBase = window.location.href.replace("bug-report-config", "bug-report");

  function setValid() {
    console.log("onClick called");
    microsoftTeams.settings.setValidityState(true);
  }

  microsoftTeams.initialize();
  microsoftTeams.settings.registerOnSaveHandler(function(saveEvent){
      console.log("calling registerOnSaveHandler");
      console.log(contentUrlBase);

      var settings = {
          entityId: "Report a Bug",
          contentUrl: contentUrlBase,
          suggestedDisplayName: "Report a Bug",
      }

      console.log(settings);
      microsoftTeams.settings.setSettings(settings);

      saveEvent.notifySuccess();
  });

})();