'use strict';

(function () {
    $().ready(function () {
        microsoftTeams.initialize();

        // Get the tab context, and use the information to navigate to Azure AD login page
        microsoftTeams.getContext(function (context) {
            // Generate random state string and store it, so we can verify it in the callback
            let state = _guid(); // _guid() is a helper function in the sample
            localStorage.setItem("simple.state", state);
            localStorage.removeItem("simple.error");
            // Go to the Azure AD authorization endpoint
            let queryParams = {
                client_id: "b8d01464-c3fc-4573-a2c3-55ed9113620c",
                //response_type: "id_token token",
                //response_mode: "fragment",
                //resource: "https://graph.microsoft.com/User.Read openid",
                scope: ["User.Read"],
                //redirect_uri: window.location.origin + "/tab-auth/simple-end",
                redirect_uri: "https://tap-validation-tab.azurewebsites.net/.auth/login/aad?post_login_redirect_url=/tab-auth/simple-end",
                nonce: _guid(),
                state: state,
                // The context object is populated by Teams; the loginHint attribute
                // is used as hinting information
                login_hint: context.loginHint,
            };

            //let authorizeEndpoint = "https://login.microsoftonline.com/" + context.tid + "/oauth2/v2.0/authorize?" + toQueryString(queryParams);
            // We're using the EasyAuth login endpoint instead of the normal one provided by Teams
            let authorizeEndpoint = "https://tap-validation-tab.azurewebsites.net/.auth/login/aad?post_login_redirect_url=/tab-auth/simple-end";
            window.location.assign(authorizeEndpoint);
        });
        /*
        microsoftTeams.getContext(function (context) {
            // ADAL.js configuration
            let config = {
                clientId: "0dfd80d6-25d7-4670-a996-eb20888d9b94",
                redirectUri: window.location.origin + "/silent-auth/silent-end",       // This should be in the list of redirect uris for the AAD app
                //redirectUri: window.location.origin + 
                cacheLocation: "localStorage",
                navigateToLoginRequestUrl: false,
            };

            // Setup extra query parameters for ADAL
            // - openid and profile scope adds profile information to the id_token
            // - login_hint provides the expected user name
            if (context.upn) {
                config.extraQueryParameters = "scope=openid+profile&login_hint=" + encodeURIComponent(context.upn);
            } else {
                config.extraQueryParameters = "scope=openid+profile";
            }

            // Use a custom displayCall function to add extra query parameters to the url before navigating to it
            config.displayCall = function (urlNavigate) {
                if (urlNavigate) {
                    if (config.extraQueryParameters) {
                        urlNavigate += "&" + config.extraQueryParameters;
                    }
                    window.location.replace(urlNavigate);
                }
            }

            // Navigate to the AzureAD login page        
            let authContext = new AuthenticationContext(config);
            authContext.login();
        });
        */

        // Build query string from map of query parameter
        function toQueryString(queryParams) {
            let encodedQueryParams = [];
            for (let key in queryParams) {
                encodedQueryParams.push(key + "=" + encodeURIComponent(queryParams[key]));
            }
            return encodedQueryParams.join("&");
        }
        // Converts decimal to hex equivalent
        // (From ADAL.js: https://github.com/AzureAD/azure-activedirectory-library-for-js/blob/dev/lib/adal.js)
        function _decimalToHex(number) {
            var hex = number.toString(16);
            while (hex.length < 2) {
                hex = '0' + hex;
            }
            return hex;
        }

        // Generates RFC4122 version 4 guid (128 bits)
        // (From ADAL.js: https://github.com/AzureAD/azure-activedirectory-library-for-js/blob/dev/lib/adal.js)
        function _guid() {
            // RFC4122: The version 4 UUID is meant for generating UUIDs from truly-random or
            // pseudo-random numbers.
            // The algorithm is as follows:
            //     Set the two most significant bits (bits 6 and 7) of the
            //        clock_seq_hi_and_reserved to zero and one, respectively.
            //     Set the four most significant bits (bits 12 through 15) of the
            //        time_hi_and_version field to the 4-bit version number from
            //        Section 4.1.3. Version4
            //     Set all the other bits to randomly (or pseudo-randomly) chosen
            //     values.
            // UUID                   = time-low "-" time-mid "-"time-high-and-version "-"clock-seq-reserved and low(2hexOctet)"-" node
            // time-low               = 4hexOctet
            // time-mid               = 2hexOctet
            // time-high-and-version  = 2hexOctet
            // clock-seq-and-reserved = hexOctet:
            // clock-seq-low          = hexOctet
            // node                   = 6hexOctet
            // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
            // y could be 1000, 1001, 1010, 1011 since most significant two bits needs to be 10
            // y values are 8, 9, A, B
            var cryptoObj = window.crypto || window.msCrypto; // for IE 11
            if (cryptoObj && cryptoObj.getRandomValues) {
                var buffer = new Uint8Array(16);
                cryptoObj.getRandomValues(buffer);
                //buffer[6] and buffer[7] represents the time_hi_and_version field. We will set the four most significant bits (4 through 7) of buffer[6] to represent decimal number 4 (UUID version number).
                buffer[6] |= 0x40; //buffer[6] | 01000000 will set the 6 bit to 1.
                buffer[6] &= 0x4f; //buffer[6] & 01001111 will set the 4, 5, and 7 bit to 0 such that bits 4-7 == 0100 = "4".
                //buffer[8] represents the clock_seq_hi_and_reserved field. We will set the two most significant bits (6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively.
                buffer[8] |= 0x80; //buffer[8] | 10000000 will set the 7 bit to 1.
                buffer[8] &= 0xbf; //buffer[8] & 10111111 will set the 6 bit to 0.
                return _decimalToHex(buffer[0]) + _decimalToHex(buffer[1]) + _decimalToHex(buffer[2]) + _decimalToHex(buffer[3]) + '-' + _decimalToHex(buffer[4]) + _decimalToHex(buffer[5]) + '-' + _decimalToHex(buffer[6]) + _decimalToHex(buffer[7]) + '-' +
                    _decimalToHex(buffer[8]) + _decimalToHex(buffer[9]) + '-' + _decimalToHex(buffer[10]) + _decimalToHex(buffer[11]) + _decimalToHex(buffer[12]) + _decimalToHex(buffer[13]) + _decimalToHex(buffer[14]) + _decimalToHex(buffer[15]);
            }
            else {
                var guidHolder = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
                var hex = '0123456789abcdef';
                var r = 0;
                var guidResponse = "";
                for (var i = 0; i < 36; i++) {
                    if (guidHolder[i] !== '-' && guidHolder[i] !== '4') {
                        // each x and y needs to be random
                        r = Math.random() * 16 | 0;
                    }
                    if (guidHolder[i] === 'x') {
                        guidResponse += hex[r];
                    } else if (guidHolder[i] === 'y') {
                        // clock-seq-and-reserved first hex is filtered and remaining hex values are random
                        r &= 0x3; // bit and with 0011 to set pos 2 to zero ?0??
                        r |= 0x8; // set pos 3 to 1 as 1???
                        guidResponse += hex[r];
                    } else {
                        guidResponse += guidHolder[i];
                    }
                }
                return guidResponse;
            }
        };

    });

})();