'use strict';

(function () {

   // PRODUCTION
    var contentUrlBase = "https://tap-validation-tab.azurewebsites.net/validations/";

    // TESTING
    //var contentUrlBase = "https://213b9289.ngrok.io/validations/";

    // This doesn't work
    //var contentUrlBase = "../validations/";

    $(function () {
        microsoftTeams.getContext(function (context) {
            var alias = context["userPrincipalName"].split("@")[0];
            console.log($('#your-validations').find(".owner-" + alias));
            $('#your-validations').find('.owner-' + alias).css('display', '');
            $('#other-validations').find('.owner-' + alias).css('display', 'none');
        });
    });

  function setValid() {
    console.log("onClick called");
    microsoftTeams.settings.setValidityState(true);
    }

  microsoftTeams.initialize();
  microsoftTeams.settings.registerOnSaveHandler(function(saveEvent){
      console.log("calling registerOnSaveHandler");

      $(".val").each(function (index) {
          //console.log($(this));
          var radio = $(this).find('[name="validation"]');
          //console.log(radio);
          if (radio.is(':checked')) {
              var groups = $(this).find('[name="group"]');
              var showVector = "";
              groups.each(function (ind2) {
                  if ($(this).is(':checked')) {
                      showVector += "1";
                  } else {
                      showVector += "0";
                  }
              })
              //console.log(showVector);
              //console.log(radio[0].value);
              //console.log(radio[0].id);

              var settings = {
                  entityId: radio[0].value,
                  contentUrl: contentUrlBase + radio[0].id + "&show=" + showVector,
                  suggestedDisplayName: "V " + radio[0].value,
              }

              console.log(settings);
              microsoftTeams.settings.setSettings(settings);
          }
      });

      saveEvent.notifySuccess();
  });

})();