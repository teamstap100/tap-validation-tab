/*
 * Functionality for logged-in users.
 * Has some functions to automatically refresh the login and tokens while the user is keeping the page open.
 * Also has functions to get the current access/ID tokens, for executing ajax requests to protected APIs.
 * 
*/

'use strict';

(function () {
    $().ready(function () {
        console.log("AuthController is running");

        function getCookie(cname) {
            var name = cname + "=";
            var decodedCookie = decodeURIComponent(document.cookie);
            var ca = decodedCookie.split(';');
            for (var i = 0; i < ca.length; i++) {
                var c = ca[i];
                while (c.charAt(0) == ' ') {
                    c = c.substring(1);
                }
                if (c.indexOf(name) == 0) {
                    return c.substring(name.length, c.length);
                }
            }
            return "";
        }

        function refreshToken() {
            console.log("Refreshing token");
            //xhr.setRequestHeader("Cookie", "name=value; name2=value2");
            // TODO: This looks like an HttpOnly header. Need to see if it's getting sent to the server anyway
            let sessionCookie = getCookie("AppServiceAuthSession");
            console.log(sessionCookie)
            $.ajax({
                url: window.location.origin + "/.auth/refresh",
                type: "GET",
                success: function () {
                    console.log("Done refreshing token");
                },
                error: function (xhr, textStatus, errorThrown) {
                    console.log("Error refreshing token");
                    console.log("textStatus: " + textStatus + ", errorThrown:" + errorThrown);
                }
            });
        }

        function refreshLogin() {
            console.log("Refreshing login");
            document.getElementById('hiddenLoginFrame').src = '/.auth/login/aad?prompt=none&domain_hint=microsoft.com';
        }

        // Begin refreshing token every 10 minutes?
        //setInterval(refreshToken, 60000);

        // Silently login again every 10 minutes
        setInterval(refreshLogin, 60000);


    });

})();