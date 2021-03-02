'use strict';

(function () {
    var userPrefsUrlBase = "../api/users/";

    function getUserPrefs() {
        microsoftTeams.getContext(function (context) {
            let oid = context['userObjectId'];

            console.log("Getting user prefs");
            let userPrefsUrl = userPrefsUrlBase + oid;
            ajaxRequest('GET', userPrefsUrl, {}, function (data) {
                console.log("Done");
                if (data) {
                    data = JSON.parse(data);

                    if (data.windowsBuildVersion) {
                        $('#windowsBuildVersion').val(data.windowsBuildVersion).trigger('change');
                    }

                    if (data.windowsBuildType) {
                        $('#windowsBuildType').val(data.windowsBuildType).trigger('change');
                    }
                    if (data.votesPublic) {
                        $('#votesPublicField').prop('checked', true);
                    }

                    if (data.feedbackPublic) {
                        $('#feedbackPublicField').prop('checked', true);
                    }

                    if (data.featureRequestsPublic) {
                        $('#featureRequestsPublicField').prop('checked', true);
                    }

                    if (data.device) {
                        console.log("Setting device");
                        $('#deviceSelect').val(data.device).trigger('change');
                    }

                    //userPrefs = data;

                    return data;
                } else {
                    return {};
                }

            });
        });
    }

    function setUserPrefs() {
        console.log("Setting user prefs");
        microsoftTeams.getContext(function (context) {
            let oid = context['userObjectId'];
            let email = cleanEmail(context['userPrincipalName']);

            let prefs = {};

            if ($('#windowsBuildType').val()) {
                //console.log("Setting windowsBuildType");
                prefs['windowsBuildType'] = $('#windowsBuildType').val();
            }

            if ($('#windowsBuildVersion').val()) {
                //console.log("Setting windowsBuildVersion");
                prefs['windowsBuildVersion'] = $('#windowsBuildVersion').val();
            }

            if ($('#deviceSelect').val()) {
                //console.log("Setting device");
                prefs["device"] = $('#deviceSelect').val();
            }

            prefs['votesPublic'] = $('#votesPublicField').is(':checked');
            prefs['feedbackPublic'] = $('#feedbackPublicField').is(':checked');
            prefs['featureRequestPublic'] = $('#featureRequestPublicField').is(':checked');

            let params = {
                oid: oid,
                email: email,
                prefs: prefs,
            }

            let userPrefsUrl = userPrefsUrlBase + oid;
            ajaxRequest('POST', userPrefsUrl, params, function (data) {
                //let userPrefs = prefs;
                //console.log("Set preferences");
            });
        });
    }

    $(document).ready(function () {
        //console.log("Userprefs ready");
        microsoftTeams.initialize();

        getUserPrefs();

        // Set user preferences when certain fields are filled out
        $('.setUserPrefs').change(function () {
            setUserPrefs();
        });

        /*
        $("#votesPublicField").change(function () {
            setUserPrefs();
        });

        $("#feedbackPublicField").change(function () {
            setUserPrefs();
        });

        $('#featureRequestsPublicField').change(function () {
            setUserPrefs();
        })

        $('#windowsBuildType').change(function () {
            setUserPrefs();
        });

        $('#windowsBuildVersion').change(function () {
            setUserPrefs();
        });
        */

    });
})();