'use strict';

(function () {

   // PRODUCTION
    //var contentUrlBase = "https://tap-validation-tab.azurewebsites.net/bugs/";

    // TESTING
    var contentUrlBase = "https://07527890.ngrok.io/bugs/";

    // This doesn't work
    //var contentUrlBase = "../validations/";

    $().ready(function () {
        var table = $('#tenants').DataTable({
            info: false,
            search: true,
            paging: false,
            //order: [[3, 'desc']],
        });
    });

  function setValid() {
    console.log("onClick called");
    microsoftTeams.settings.setValidityState(true);
  }

  microsoftTeams.initialize();
  microsoftTeams.settings.registerOnSaveHandler(function(saveEvent){
      console.log("calling registerOnSaveHandler");

      var selectedTenantId;

      selectedTenantId = $('input[name=tenant]:checked')[0].id;

      var settings = {
          entityId: selectedTenantId,
          contentUrl: contentUrlBase + selectedTenantId,
          suggestedDisplayName: "Bugs",
      }

      console.log(settings);
      microsoftTeams.settings.setSettings(settings);

      saveEvent.notifySuccess();
  });

})();