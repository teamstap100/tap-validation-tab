'use strict';

(function () {
    $().ready(function () {
        microsoftTeams.initialize();

        $('#login').click(function () {
            console.log("Clicked login");
            //window.open("https://tap-validation-tab-admin-2.azurewebsites.net/.auth/login/aad", "Login to AAD", "width=600,height=300,left=100,top=100");
            microsoftTeams.authentication.authenticate({
                //url: "https://tap-validation-tab-admin-2.azurewebsites.net/.auth/login/aad?post_login_redirect_url=/tab-auth/simple-end",
                url: window.location.origin + "/tab-auth/simple-start",
                width: 600,
                height: 535,
                successCallback: function (result) {
                    console.log("Success");
                    console.log(result);

                    const queryString = window.location.search;
                    const urlParams = new URLSearchParams(queryString);
                    console.log(urlParams.get("redirect"));
                    window.location.replace(".." + urlParams.get("redirect"));
                },
                failureCallback: function (reason) {
                    console.log("Error");
                    console.log(reason);
                }
            });
        });
    });

})();