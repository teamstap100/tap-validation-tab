'use strict';

(function () {

   // PRODUCTION
    var contentUrlBase = "https://tap-validation-tab.azurewebsites.net/issues/";

    // TESTING
    //var contentUrlBase = "https://c852da2a.ngrok.io/issues/";

    // This doesn't work
    //var contentUrlBase = "../validations/";

    $(function () {
        microsoftTeams.getContext(function (context) {
            var alias = context["loginHint"].split("@")[0];
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

      var tags = "";

      $(".val").each(function (index) {
          var checkbox = $(this).find('[name="validation"]');
          if (checkbox.is(':checked')) {
              tags += checkbox[0].id + "&";
              console.log(tags);
          }
      });

      tags = tags.replace(/\&+$/, "");

      var settings = {
          entityId: tags,
          contentUrl: contentUrlBase + tags,
          suggestedDisplayName: "Known Issues",
      }

      console.log(settings);
      microsoftTeams.settings.setSettings(settings);

      saveEvent.notifySuccess();
  });

})();