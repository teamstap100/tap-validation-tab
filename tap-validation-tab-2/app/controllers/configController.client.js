'use strict';

(function () {

   // PRODUCTION
    var contentUrlBase = "https://tap-validation-tab.azurewebsites.net/validations/";

    // TESTING
    //var contentUrlBase = "https://5ddc1aba.ngrok.io/validations/";

    // This doesn't work
    //var contentUrlBase = "../validations/";

    $(function () {

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

      /*
      var radios = document.getElementsByName("validation");


      radios.forEach(function(radio) {
          if (radio.checked) {

            var thisRadioValue = radio.value;
            console.log(thisRadioValue);
            var settings = {
                entityId: thisRadioValue,
                contentUrl: contentUrlBase + radio.id,
                suggestedDisplayName: "V " + thisRadioValue,
            }
            console.log(settings);
            microsoftTeams.settings.setSettings(settings);
        }
          });
      */

      saveEvent.notifySuccess();
  });

})();