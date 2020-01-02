'use strict';

(function () {
    function cleanEmail(email) {
        email = email.replace("#EXT#@microsoft.onmicrosoft.com", "");
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
        return email;
    }

    microsoftTeams.initialize();

    $().ready(function () {
        console.log("Ready");
        const tid = $('#tenantId').text();

        $('#bugsTable').DataTable({
            ajax: {
                url: "../api/tenantBugs/" + tid,
                dataSrc: "bugs",
            },
            columns: [
                { "data": "id" },
                { "data": "date" },
                { "data": "title" },
                { "data": "state" },
                { "data": "triaged" },
                { "data": "comments", visible: false },
            ],
            // Apply a link to the title cell
            "columnDefs": [{
                "targets": 2,
                "render": function (data, type, row, meta) {
                    console.log(row);
                    var itemID = row.id;
                    var comments = row.comments;
                    return "<a class='bug-modal-launch', data-target='#bug-modal', data-toggle='modal', id='" + itemID + "', data-bug='" + JSON.stringify(row) + "'>" + data + "</a>";
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
            ],

            initComplete: function () {
                $('.bug-modal-launch').click(function (e) {
                    console.log("Doing the modal launch function");
                    let id = this.id;
                    console.log(id);
                    $('#bug-id').text(id);
                    $("#bugLabelHeader").text($("#" + id).text());
                    let data = $('#' + id).data('bug');
                    console.log(data);
                    let comments = data.comments;
                    comments.forEach(function (comment) {
                        console.log(comment);
                        $('#existingComments').text($('#existingComments').text().replace("No comments submitted yet.", ""));
                        $('#existingComments').append('<p>"' + comment.comment + '" - ' + comment.userEmail + " (" + new Date(comment.timestamp).toLocaleDateString() + ")</p>");
                    });
                });
            }

        });

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