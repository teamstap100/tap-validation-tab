'use strict';

(function () {
    microsoftTeams.initialize();

    $().ready(function () {

        $('.performanceTable').DataTable({
            paging: false,
            info: false,
            searching: false,
            order: [[2, "desc"], [0, "desc"]],
        });

        function ajaxRequest(method, url, params, callback) {
            var xmlhttp = new XMLHttpRequest();

            xmlhttp.onreadystatechange = function () {
                if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
                    callback(xmlhttp.response);
                }
            };

            xmlhttp.open(method, url, true);
            console.log("Stringified: " + JSON.stringify(params));
            xmlhttp.setRequestHeader('Content-Type', 'application/json');
            xmlhttp.send(JSON.stringify(params));
        }


    });

})();