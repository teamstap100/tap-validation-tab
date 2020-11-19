'use strict';

(function () {
    microsoftTeams.initialize();

    $().ready(function () {

        $('#features').DataTable({
            paging: false,
            info: false,
            //searching: false,
            //order: [[2, "desc"], [0, "desc"]],
        });

    });

})();