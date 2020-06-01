'use strict';

(function () {
    const MICROSOFT_TID = "72f988bf-86f1-41af-91ab-2d7cd011db47";
    const spinner = '<i class="fa fa-spinner fa-spin"></i>  ';
    const centerSpinner = '<div style="text-align: center;"><i class="fa fa-spinner fa-spin"></i></div>';
    const check = "<i class='fa fa-check' style='color: green;'></i>";

    const ADO_PREFIX = "https://domoreexp.visualstudio.com/MSTeams/_workitems/edit/";

    const CHECKBOX_COLUMN = 0;
    const TITLE_COLUMN = 3;
    const STATUS_COLUMN = 5;
    const COMMENT_COUNT_COLUMN = 7;
    const TRIAGED_COLUMN = 8;

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

    function cleanUpForms() {
        $('#triageForm').collapse('hide');
        $('#commentForm').collapse('hide');
        $('#closeBugForm').collapse('hide');
        $('#validationField').val("");
        $('#closeCommentField').val("");
        $('#commentField').val("");
        $('#duplicateIdField').val("");
        $('#bulkCloseCommentField').val("");
        $('#bulkDuplicateIdField').val("");


        $("input:radio[name ='extentField']").prop("checked", false);
        $("input:checkbox[name ='ringsField']").prop("checked", false);
        $("input:radio[name ='everWorkedField']").prop("checked", false);
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
                        $('#loading').show();
                        initEverything();
                    } else {
                        console.log("Not visible");
                        showWrongTenantBanner();
                    }
                }
            });
        })

        function showComment(comment) {
            let submissionDirectionClass = "";
            let submissionNametagClass = "";
            if ((comment.createdBy.uniqueName == "tapfenix@microsoft.com") || !(comment.createdBy.uniqueName.includes("@microsoft.com"))) {
                if (comment.text.includes("@microsoft.com replied:")) {
                    submissionDirectionClass = "fenix-dev";
                } else {
                    submissionDirectionClass = "fenix-customer";
                }
            } else {
                submissionDirectionClass = "fenix-dev";
            }
            submissionNametagClass = submissionDirectionClass + "-nametag";

            //var temp = document.createElement("div");
            //temp.innerHTML = comment.text
            //let safeComment =  temp.textContent || temp.innerText || "";

            //let safeComment = comment.text.replace(/<\/?[^>]+>/ig, " ");

            let safeComment = comment.text.replace(/<style.*?<\/style>/g, '');
            //if (safeComment.)

            if (comment.createdBy.displayName == "TAP-Fenix") {
                comment.createdBy.displayName = "Customer";
            }

            console.log(submissionDirectionClass);
            $('#bug-comments').append("<div class='" + submissionNametagClass + "'>" + comment.createdBy.displayName + " (" + comment.createdDate.split("T")[0] + ")" + "</div><div class='well well - sm " + submissionDirectionClass + "'><p style='font - size: 12px'>" + safeComment + "</p></div>");

            return;
        }

        function initEverything() {
            var bugsTable = $('#bugsTable').DataTable({
                //autoWidth: false,
                ajax: {
                    url: "../api/tenantBugs/" + tid,
                    dataSrc: "bugs",
                    error: function (xhr, status, err) {
                        console.log("Error: " + status + " " + err);
                        $("#errorMsg").show();
                        $('#loading').hide();
                    },
                },
                columns: [
                    {},
                    { "data": "id" },
                    { "data": "date" },
                    { "data": "title" },
                    { "data": "submitter" },
                    { "data": "state" },
                    { "data": "reason" },
                    { "data": "commentCount" },
                    { "data": "triaged" },
                    //{ "data": "statusTweet" },
                    //{ "data": "triaged" },
                    { "data": "reproSteps", visible: false },
                    //{ "data": "comments", visible: false },
                ],
                // Apply a link to the title cell
                columnDefs: [
                    {
                        "targets": CHECKBOX_COLUMN,
                        render: function (data, type, row, meta) {
                            return "<input type='checkbox', name='bugSelect', title='Select multiple bugs to perform bulk operations on.' value='" + row.id + "' />";
                        }
                    },
                    {
                        // Title - needs link to open the modal
                        "targets": TITLE_COLUMN,
                        "width": 500,
                        "render": function (data, type, row, meta) {
                            //console.log(row);
                            var itemID = row.id;
                            var itemTitle = row.title;
                            var reproSteps = row.reproSteps;


                            // TODO: Can't figure out the escapes quite yet
                            let safeRow = JSON.stringify(row).replace(/'/g, "\\'").replace(/"/g, '\\"');
                            //return "<a class='bug-modal-launch', data-target='#bug-modal', data-toggle='modal', id='" + itemID + "', data-bug='" + safeRow + "'>" + data + "</a>";
                            return "<a class='bug-modal-launch', data-target='#bug-modal', data-toggle='modal', id='" + itemID + "'>" + data + "</a>";

                        }
                    },

                    // 'triaged' column - Needs replacement with icon
                    {
                        targets: TRIAGED_COLUMN,
                        render: function (data, type, row, meta) {
                            if (data) {
                                return check;
                            } else {
                                return "";
                            }
                        }
                    }
                ],

                paging: false,
                info: false,
                order: [[1, "desc"]],
                aoColumns: [
                    {},
                    { "orderSequence": ["desc", "asc"], type: "html-num" },
                    { "orderSequence": ["asc", "desc"], },
                    { "orderSequence": ["asc", "desc"] },
                    { "orderSequence": ["desc", "asc"], type: "html-num" },
                    { "orderSequence": ["asc", "desc"] },
                    { "orderSequence": ["asc", "desc"] },
                    { "orderSequence": ["asc", "desc"] },
                    { "orderSequence": ["asc", "desc"] },
                    { "orderSequence": ["asc", "desc"] },
                    //{ "orderSequence": ["asc", "desc"] },
                ],

                // Copy and Excel buttons?
                dom: 'Bfrtip',
                buttons: [
                    {
                        extend: 'excel',
                        filename: "Bug Submissions",
                        title: null,
                        text: "Export table to Excel"
                    },
                ],

                initComplete: function () {
                    $('#loading').hide();
                    $('#bugsTableContainer').show();

                    this.api().columns([4, 5, 6, 8]).every(function () {
                        var column = this;
                        var select = $('<select><option value=""></option></select>')
                            .appendTo($(column.footer()).empty())
                            .on('change', function () {
                                var val = $.fn.dataTable.util.escapeRegex(
                                    $(this).val()
                                );

                                column
                                    .search(val ? '^' + val + '$' : '', true, false)
                                    .draw();
                            });

                        column.data().unique().sort().each(function (d, j) {
                            if (d != "") {
                                select.append('<option value="' + d + '">' + d + '</option>')
                            }
                        });
                    });

                    $('.bug-modal-launch').click(function (e) {
                        let id = this.id;
                        let witRow = bugsTable.row('#' + id);
                        let rowData = witRow.data();

                        //console.log(rowData);

                        $('#bug-id').text(id);
                        //$('#bugLabelHeader').text("Bug #" + id + " submitted by " + rowData.submitter);
                        $('#bugLabelHeader').text("Bug #" + id + " (" + rowData.state + " - " + rowData.reason + ")");
                        $('#bug-submitter').html("<strong>Submitter: </strong>" + rowData.submitter);
                        $('#bug-reproSteps').html(rowData.reproSteps);
                        $('#bug-comments-count').html("(" + rowData.commentCount + ")");

                        /*
                        // Add all the bugs to the "duplicate bugs" datalist
                        // Reset duplicate bug datalist
                        $('#duplicateBugs').html("");
                        // Put in all the bugs except this one
                        bugsTable.rows().data().each(function (value, index) {
                            console.log(value);
                            if (value.id != id) {
                                $('#duplicateBugs').append($("<option>").attr('value', value.id).text(value.title));
                            }
                        });
                        */


                        if (rowData.commentCount > 0) {
                            $('#bug-comments').html(centerSpinner);

                            // New: Let's get comments using ajax
                            let commentsUrl = "../api/bugs/comments/" + id;

                            ajaxRequest('GET', commentsUrl, {}, function (data) {
                                $('#bug-comments').html("");
                                data = JSON.parse(data);
                                let comments = data.comments;
                                comments.forEach(function (comment) {
                                    console.log(comment);
                                    showComment(comment);
                                })
                                //$('#bug-comments-count').html("(" + comments.length + ")");
                            });
                        } else {
                            $('#bug-comments').html('');
                        }

                        if ((rowData.state.includes("Close")) || (rowData.state.includes("Resolved"))) {
                            console.log("Bug closed or close requested");
                            $('#openCloseForm').attr('disabled', true);
                        } else {
                            $('#openCloseForm').attr('disabled', false);
                        }

                        // Duplicate ID field depends on table data
                        $('#duplicateIdField').on('input', function () {
                            let valid = false;

                            let duplicateIdValue = $('#duplicateIdField').val();

                            if (duplicateIdValue) {
                                bugsTable.rows().data().each(function (value, index) {
                                    if (duplicateIdValue == value.id) {
                                        valid = true;
                                    }
                                });
                            } else {
                                // Empty values are ok
                                valid = true;
                            }


                            if (valid) {
                                $('#duplicate-warning').hide();
                            } else {
                                $('#duplicate-warning').show();
                            }
                        });

                        $("#bug-modal").on("hidden.bs.modal", function () {
                            cleanUpForms();
                        });

                        // Keep only one form open at once
                        $('#openTriageForm').on('click', function () {
                            $('#commentForm').collapse('hide');
                            $('#closeBugForm').collapse('hide');
                        })

                        $('#openCommentForm').on('click', function () {
                            $('#triageForm').collapse('hide');
                            $('#closeBugForm').collapse('hide');
                        })

                        $('#openCloseForm').on('click', function () {
                            $('#triageForm').collapse('hide');
                            $('#commentForm').collapse('hide');
                        })

                        // Triage button
                        $('#validationField').on('input', function () {
                            checkTriageFormStatus();
                        })
                        $("input:radio[name ='extentField']").change(function () {
                            checkTriageFormStatus();
                        });

                        $("input:checkbox[name ='ringsField']").change(function () {
                            checkTriageFormStatus();
                        });

                        $("input:radio[name ='everWorkedField']").change(function () {
                            checkTriageFormStatus();
                        });

                        $('#triageSubmit').click(function () {
                            let extent = $("input:radio[name ='extentField']:checked").val();

                            let rings = [];
                            $('input[name="ringsField"]:checked').each(function () {
                                rings.push(this.value);
                            });

                            let everWorked = $("input:radio[name ='everWorkedField']:checked").val();

                            let bugId = $('#bug-id').text();

                            let validationName = $('#validationField').val();

                            $("#triageSubmit").prop("disabled", true);
                            $("#triageSubmit").html(spinner + $('#triageSubmit').text());

                            microsoftTeams.getContext(function (context) {
                                let params = {
                                    submitter: context["userPrincipalName"],
                                    extent: extent,
                                    rings: rings,
                                    everWorked: everWorked,
                                    id: bugId,
                                    validationName: validationName,
                                }

                                let triageUrl = "../api/bugs/triage";

                                ajaxRequest('POST', triageUrl, params, function () {
                                    console.log("Done");

                                    $('#triageSubmit').prop("disabled", false);
                                    $('#triageSubmit').html($('#triageSubmit').html().replace(spinner, ''));

                                    $('#bug-modal').modal('hide');

                                    cleanUpForms();

                                    bugsTable.cell('#' + bugId, TRIAGED_COLUMN).data(check);


                                    // Increment comment count
                                    bugsTable.cell('#' + bugId, COMMENT_COUNT_COLUMN).data(bugsTable.cell('#' + bugId, COMMENT_COUNT_COLUMN).data() + 1);

                                });
                            });
                        })

                        $('#commentField').on('input', function () {
                            //console.log($('#commentField').val());
                            if ($('#commentField').val()) {
                                $('#commentSubmit').attr('disabled', false);
                            } else {
                                $('#commentSubmit').attr('disabled', true);
                            }
                        });


                        $('#closeCommentField').on("input", function () {
                            if ($('#closeCommentField').val()) {
                                $('#closeSubmit').attr('disabled', false);
                            } else {
                                $('#closeSubmit').attr('disabled', true);
                            }
                        })

                        $('#closeSubmit').click(function (e) {
                            $("#closeSubmit").prop("disabled", true);
                            $("#closeSubmit").html(spinner + $('#closeSubmit').text());

                            let bugId = $('#bug-id').text();
                            let duplicateId = $('#duplicateIdField').val();

                            let closeBugUrl = "../api/bugs/close";

                            microsoftTeams.getContext(function (context) {
                                let params = {
                                    submitter: context["userPrincipalName"],
                                    comment: $('#closeCommentField').val(),
                                    id: bugId,
                                    duplicateId: duplicateId
                                };

                                ajaxRequest('POST', closeBugUrl, params, function () {
                                    console.log("Done");
                                    $('#closeSubmit').prop("disabled", false);
                                    $('#closeSubmit').html($('#closeSubmit').html().replace(spinner, ''));

                                    $('#bug-modal').modal('hide');

                                    // Mark this as closed in the table
                                    bugsTable.cell('#' + bugId, STATUS_COLUMN).data("Close Requested");
                                    // Increment comment count
                                    bugsTable.cell('#' + bugId, COMMENT_COUNT_COLUMN).data(bugsTable.cell('#' + bugId, COMMENT_COUNT_COLUMN).data() + 1);

                                    cleanUpForms();
                                });
                            });
                        });

                        $('#commentSubmit').click(function (event) {
                            //stop submit the form, we will post it manually.
                            event.preventDefault();

                            // Get form
                            var form = $('#comment-submit-form')[0];

                            // Create an FormData object
                            var data = new FormData(form);

                            // If you want to add an extra field for the FormData
                            //data.append("comment", $('#commentField').text());

                            // disabled the submit button
                            $("#commentSubmit").prop("disabled", true);
                            $("#commentSubmit").html(spinner + $('#commentSubmit').text());

                            $.ajax({
                                type: "POST",
                                enctype: 'multipart/form-data',
                                url: "/api/upload",
                                data: data,
                                processData: false,
                                contentType: false,
                                cache: false,
                                timeout: 600000,
                                success: function (data) {
                                    $("#result").text(data);
                                    console.log("SUCCESS : ", data);

                                    var bugId = $('#bug-id').text();

                                    let commentBugUrl = "../api/bugs/comment";

                                    microsoftTeams.getContext(function (context) {
                                        let params = {
                                            submitter: context["userPrincipalName"],
                                            comment: $('#commentField').val(),
                                            id: bugId,
                                            attachmentFilename: data.filename,
                                        }

                                        ajaxRequest('POST', commentBugUrl, params, function () {
                                            console.log("Done");
                                            $('#commentField').val("");
                                            $('#commentFileUpload').val("");
                                            $('#commentSubmit').text($('#commentSubmit').text().replace(spinner, ""));

                                            $('#bug-modal').modal('hide');
                                            cleanUpForms();

                                            // Increment the comment count
                                            bugsTable.cell('#' + bugId, COMMENT_COUNT_COLUMN).data(bugsTable.cell('#' + bugId, COMMENT_COUNT_COLUMN).data() + 1);
                                        });
                                    });

                                    $("#commentSubmit").prop("disabled", false);
                                },
                                error: function (e) {
                                    // TODO: Do more helpful stuff, probably still submit the text feedback
                                    $("#result").text(e.responseText);
                                    console.log("ERROR : ", e);
                                    $("#commentSubmit").prop("disabled", false);
                                }
                            });
                        });

                    });

                    $('input[name="bugSelect"]').change(function () {
                        console.log("Selectd a bug");
                        let bugIds = [];
                        $('input[name="bugSelect"]:checked').each(function () {
                            bugIds.push(this.value);
                        });

                        console.log(bugIds);

                        if (bugIds.length > 0) {
                            $('#getBugbashList').prop("disabled", false);
                            $('#bulkClose').prop("disabled", false);
                        } else {
                            $('#getBugbashList').prop("disabled", true);
                            $('#bulkClose').prop("disabled", true);
                        }
                    })



                    $('#getBugbashList').click(function () {
                        $('#bugbash-list-modal').modal('show');
                        $('#bugbash-table-tbody').html("");
                        console.log("Clicked it");
                        let bugIds = [];
                        $('input[name="bugSelect"]:checked').each(function () {
                            bugIds.push(this.value);
                        });
                        console.log(bugIds);

                        bugIds.forEach(function(bugId) {
                            let row = bugsTable.row('#' + bugId).data();
                            console.log(row);
                            $('#bugbash-table-tbody').append("<tr><td><a href='" + ADO_PREFIX + row.id + "'>" + row.id + "</a></td><td>" + row.title + "</td></tr>");
                        });
                    });

                    $('#bulkClose').click(function () {
                        $('#bulk-close-modal').modal('show');
                        $('#bulk-close-table-tbody').html("");
                        console.log("Clicked it");
                        let bugIds = [];
                        $('input[name="bugSelect"]:checked').each(function () {
                            bugIds.push(this.value);
                        });
                        console.log(bugIds);

                        bugIds.forEach(function (bugId) {
                            let row = bugsTable.row('#' + bugId).data();
                            console.log(row);
                            $('#bulk-close-table-tbody').append("<tr><td>" + row.id + "</td><td>" + row.title + "</td></tr>");
                        });
                    })

                    $('.buttons-excel').click(function (e) {
                        $('#downloadAlert').show();
                    });

                    function checkIfBulkCloseValid() {
                        let valid = false;

                        let duplicateIdValue = $('#bulkDuplicateIdField').val();

                        if (duplicateIdValue) {
                            bugsTable.rows().data().each(function (value, index) {
                                if (duplicateIdValue == value.id) {
                                    valid = true;
                                }
                            });
                        } else {
                            // Empty values are ok
                            valid = true;
                        }

                        console.log(valid);

                        if (valid) {
                            $('#bulkDuplicate-warning').hide();
                        } else {
                            $('#bulkDuplicate-warning').show();
                        }

                        if ((valid && $('#bulkCloseCommentField').val())) {
                            $('#bulkCloseSubmit').attr('disabled', false);
                        } else {
                            $('#bulkCloseSubmit').attr('disabled', true);
                        }
                    }

                    $('#bulkCloseCommentField').on("input", function () {
                        checkIfBulkCloseValid();
                    })

                    // Duplicate ID field depends on table data
                    $('#bulkDuplicateIdField').on('input', function () {
                        checkIfBulkCloseValid();
                    });

                    $('#bulkCloseSubmit').click(function (e) {
                        $("#bulkCloseSubmit").prop("disabled", true);
                        $("#bulkCloseSubmit").html(spinner + $('#bulkCloseSubmit').text());

                        let bugIds = [];
                        $('input[name="bugSelect"]:checked').each(function () {
                            bugIds.push(this.value);
                        });

                        let duplicateId = $('#bulkDuplicateIdField').val();

                        let bulkCloseBugUrl = "../api/bugs/bulkClose";

                        microsoftTeams.getContext(function (context) {
                            let params = {
                                submitter: context["userPrincipalName"],
                                comment: $('#bulkCloseCommentField').val(),
                                ids: bugIds,
                                duplicateId: duplicateId
                            };

                            ajaxRequest('POST', bulkCloseBugUrl, params, function () {
                                console.log("Done");
                                $('#bulkCloseSubmit').prop("disabled", false);
                                $('#bulkCloseSubmit').html($('#bulkCloseSubmit').html().replace(spinner, ''));

                                $('#bug-modal').modal('hide');

                                // Mark this as closed in the table
                                bugIds.forEach(function (bugId) {
                                    bugsTable.cell('#' + bugId, STATUS_COLUMN).data("Close Requested");
                                    // Increment comment count
                                    bugsTable.cell('#' + bugId, COMMENT_COUNT_COLUMN).data(bugsTable.cell('#' + bugId, COMMENT_COUNT_COLUMN).data() + 1);
                                })

                                $('#bulk-close-modal').modal('hide');
                                cleanUpForms();
                            });
                        });
                    });

                }

            });
        }

        function showWrongTenantBanner() {
            $('#wrongTenant').show();
        }

        function checkTriageFormStatus() {
            let extent = $("input:radio[name ='extentField']:checked").val();

            let rings = [];
            $('input[name="ringsField"]:checked').each(function () {
                rings.push(this.value);
            });

            let everWorked = $("input:radio[name ='everWorkedField']:checked").val();

            let validationValid = false;

            var val = $("#validationField").val();

            // Blank is okay too
            if (val == "") {
                validationValid = true;
                $('#validation-warning').hide();

            } else {
                console.log(val);
                var obj = $("#validations").find("option[value='" + val + "']");
                if (obj != null && obj.length > 0) {
                    validationValid = true;
                    $('#validation-warning').hide();
                } else {
                    validationValid = false;
                    $('#validation-warning').show();
                }
            }

            if ((extent && rings && everWorked && validationValid)) {
                $('#triageSubmit').attr('disabled', false);
            } else {
                $('#triageSubmit').attr('disabled', true);
            }   
        }

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