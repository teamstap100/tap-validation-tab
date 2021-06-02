'use strict';

(function () {

    $.fn.dataTable.moment('M/D/YYYY');
    $.fn.dataTable.moment('YYYY-M-D');

    $().ready(function () {
        console.log("Ready");

        var bugsTable = $('#bugsTable').DataTable({
            paging: false,
            info: false,
            order: [[1, "desc"]],
            aoColumns: [
                { "orderSequence": ["asc", "desc"] },
                { "orderSequence": ["asc", "desc"] },
                { "orderSequence": ["asc", "desc"] },
                { "orderSequence": ["asc", "desc"] },
                { "orderSequence": ["asc", "desc"] },
            ],
        });
    });
})();