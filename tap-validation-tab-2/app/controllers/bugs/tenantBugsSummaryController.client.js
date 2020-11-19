'use strict';

(function () {
    microsoftTeams.initialize();

    $().ready(function () {
        console.log("Hello");

        $('#tenantTable').DataTable({
            paging: false,
            info: false,
            // Copy and Excel buttons?
            dom: 'Bfrtip',
            buttons: [
                {
                    extend: 'excel',
                    filename: "Bug Submissions by Tenant",
                    title: null,
                    text: "Export table to Excel"
                },
            ],
            //order: [[2, "desc"], [0, "desc"]],
        });

    });

})();