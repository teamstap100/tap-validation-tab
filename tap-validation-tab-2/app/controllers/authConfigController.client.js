'use strict';

(function () {

    //console.log(window.location.href);
    var contentUrl = window.location.href.replace("/config", "");

    console.log(contentUrl);

    function setValid() {
        console.log("onClick called");
        microsoftTeams.settings.setValidityState(true);
    }

    microsoftTeams.initialize();
    microsoftTeams.settings.registerOnSaveHandler(function (saveEvent) {
        console.log("calling registerOnSaveHandler");
        var radio = document.getElementById("soManyOptions");
        if (radio.checked) {
            var thisRadioValue = radio.value;
            console.log(contentUrl);
            var settings = {
                entityId: "Auth Test",
                contentUrl: contentUrl,
                suggestedDisplayName: "Auth Test",
            }
            console.log(settings);
            microsoftTeams.settings.setSettings(settings);
        }
        saveEvent.notifySuccess();
    });

})();