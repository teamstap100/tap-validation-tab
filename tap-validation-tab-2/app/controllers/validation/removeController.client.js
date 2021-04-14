'use strict';

(function () {
    microsoftTeams.initialize();
    microsoftTeams.settings.registerOnRemoveHandler((removeEvent) => {
        // Here you can designate the tab content to be removed and/or archived.
        microsoftTeams.settings.getSettings((settings) => {
            settings.contentUrl = "..."
        });
        removeEvent.notifySuccess();
        microsoftTeams.getContext(function (context) {
            var params = {
                //tabUrl: tabUrl,
                validationId: config.validationId,
                channelName: context.channelName,
                channelId: context.channelId,
                teamName: context.teamName,
                teamId: context.teamId,
            }
            console.log(params);
            //ajaxRequest('POST', updateValidationTabUrlEndpoint, params, function () {
            ////    console.log(tabUrl);
            //    console.log("Updated tab url");
            //});
        })
    });
    $('#deleteTab').click(function () {
        microsoftTeams.settings.setValidityState(true);
        console.log("API call here");
    });

})();