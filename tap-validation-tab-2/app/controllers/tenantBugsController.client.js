'use strict';

(function () {
    const MICROSOFT_TID = "72f988bf-86f1-41af-91ab-2d7cd011db47";

    function cleanEmail(email) {
        if (email) {
            email = email.toLowerCase();
            email = email.replace("#ext#@microsoft.onmicrosoft.com", "");
            if (email.includes("@")) {
                return email;

            } else if (email.includes("_")) {
                console.log("Going the underscore route");
                var underscoreParts = email.split("_");
                var domain = underscoreParts.pop();
                var tenantString = domain.split(".")[0];

                if (underscoreParts.length > 1) {
                    email = underscoreParts.join("_") + "@" + domain;
                } else {
                    email = underscoreParts[0] + "@" + domain;
                }
            }
        }

        return email;
    }

    microsoftTeams.initialize();

    $().ready(function () {
        console.log("Ready");
        const tid = $('#tenantId').text();

        microsoftTeams.getContext(function (context) {
            let email = context['userPrincipalName'];

            email = cleanEmail(email);

            let tenantUrl = "../../api/tenants";

            let params = { email: email, backup_context: context };

            ajaxRequest('POST', tenantUrl, params, function (data) {
                data = JSON.parse(data);
                console.log(data);

                if (data == null) {
                    console.log("Not visible");
                    showWrongTenantBanner();
                } else {
                    if (( data.tid == tid) || (data.tid == MICROSOFT_TID)) {
                        console.log("Make stuff visible");
                        initEverything();
                    } else {
                        console.log("Not visible");
                        showWrongTenantBanner();
                    }
                }
            });
        })

        function initEverything() {
            var bugsTable = $('#bugsTable').DataTable({
                ajax: {
                    url: "../api/tenantBugs/" + tid,
                    dataSrc: "bugs",
                },
                columns: [
                    { "data": "id" },
                    { "data": "date" },
                    { "data": "title" },
                    { "data": "submitter" },
                    { "data": "state" },
                    { "data": "statusTweet" },
                    //{ "data": "triaged" },
                    { "data": "comments", visible: false },
                    { "data": "reproSteps", visible: false },
                ],
                // Apply a link to the title cell
                "columnDefs": [{
                    "targets": 2,
                    "render": function (data, type, row, meta) {
                        //console.log(row);
                        var itemID = row.id;
                        var comments = row.comments;
                        var reproSteps = row.reproSteps;

                        // TODO: Can't figure out the escapes quite yet
                        let safeRow = JSON.stringify(row).replace(/'/g, "\\'").replace(/"/g, '\\"');
                        //return "<a class='bug-modal-launch', data-target='#bug-modal', data-toggle='modal', id='" + itemID + "', data-bug='" + safeRow + "'>" + data + "</a>";
                        return "<a class='bug-modal-launch', data-target='#bug-modal', data-toggle='modal', id='" + itemID + "'>" + data + "</a>";

                    }
                }],

                paging: false,
                info: false,
                order: [[0, "desc"]],
                aoColumns: [
                    { "orderSequence": ["desc", "asc"], type: "html-num" },
                    { "orderSequence": ["asc", "desc"], },
                    { "orderSequence": ["asc", "desc"] },
                    { "orderSequence": ["asc", "desc"] },
                    { "orderSequence": ["asc", "desc"] },
                    { "orderSequence": ["asc", "desc"] },
                    { "orderSequence": ["asc", "desc"] },
                ],
                processing: true,
                language: {
                    processing: "Loading...",
                },

                initComplete: function () {
                    $('.bug-modal-launch').click(function (e) {
                        let id = this.id;
                        let witRow = bugsTable.row('#' + id);
                        let rowData = witRow.data();

                        $('#bug-id').text(id);
                        $('#bugLabelHeader').text("Bug #" + id + " submitted by " + rowData.submitter);
                        $('#bug-reproSteps').html(rowData.reproSteps);

                        //let data = $('#' + id).data('bug');
                        //console.log(data);
                        //data = JSON.parse(data);
                        //let comments = data.comments;
                        //comments.forEach(function (comment) {
                        //    console.log(comment);
                        //    $('#existingComments').text($('#existingComments').text().replace("No comments submitted yet.", ""));
                        //    $('#existingComments').append('<p>"' + comment.comment + '" - ' + comment.userEmail + " (" + new Date(comment.timestamp).toLocaleDateString() + ")</p>");
                        //});
                        //console.log($('#bug-reproSteps'));
                        //console.log(data.reproSteps);
                        //$('#bug-reproSteps').text(data.reproSteps);
                    });
                }

            });
        }

        function showWrongTenantBanner() {
            $('#wrongTenant').show();
        }



        $('#submitComment').click(function () {
            console.log("Clicked the comment submit button");
            var bugId = $('#bug-id').text();
            var addCommentUrl = "../api/bugComments";
            console.log(addCommentUrl);
            microsoftTeams.getContext(function (context) {
                var params = {
                    bugId: parseInt(bugId),
                    comment: $('#commentField').val(),
                    userEmail: cleanEmail(context["userPrincipalName"]),
                    // no TID, it'd just be MSFT
                }
                ajaxRequest('POST', addCommentUrl, params, function () {
                    console.log("Submitted");
                    $('#commentField').val("");
                });
            })
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