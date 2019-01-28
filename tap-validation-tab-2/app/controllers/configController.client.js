'use strict';

(function () {

   // PRODUCTION
    var contentUrlBase = "https://tap-validation-tab.azurewebsites.net/validations/";

    // TESTING
    //var contentUrlBase = "https://cc2eb8a0.ngrok.io/validations/";

  function setValid() {
    console.log("onClick called");
    microsoftTeams.settings.setValidityState(true);
  }

  microsoftTeams.initialize();
  microsoftTeams.settings.registerOnSaveHandler(function(saveEvent){
  console.log("calling registerOnSaveHandler");
  var radios = document.getElementsByName("validation");
  radios.forEach(function(radio) {
    if (radio.checked) {
        var thisRadioValue = radio.value;
        var settings = {
            entityId: thisRadioValue,
            contentUrl: contentUrlBase + radio.id,
            suggestedDisplayName: "V " + thisRadioValue,
        }
        console.log(settings);
        microsoftTeams.settings.setSettings(settings);
    }
  });
  saveEvent.notifySuccess();
  });

})();