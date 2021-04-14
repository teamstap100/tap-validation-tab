$(document).ready(function () {
    const EDIT_FEEDBACK_API_URL = "../api/feedback/scenario/{id}";
    const UPVOTE_API_URL = "../api/feedback/scenario/{id}/upvote";
    const COMMENT_API_URL = "../api/feedback/scenario/{id}/comment";

    console.log("Hello");
    microsoftTeams.initialize();

    console.log("ScenarioFeedbackController ready");

    function submitEditReport(event, voteParams) {
        //stop submit the form, we will post it manually.
        event.preventDefault();

        // Get form
        var form = $('#edit-report-form')[0];

        // Create an FormData object
        var data = new FormData(form);

        // disable the submit button
        disableAndSpin('#edit-report-submit');

        if (data.files) {
            $('#edit-report-submit-status').text("Uploading...");
        }

        $.ajax({
            type: "POST",
            enctype: 'multipart/form-data',
            url: "/api/upload/multiple",
            data: data,
            processData: false,
            contentType: false,
            cache: false,
            timeout: 600000,
            success: function (data) {
                $("#result").text(data);
                console.log("SUCCESS : ", data);

                $('edit-report-submit-status').text("Submiting changes...");

                voteParams.attachments = data.files;

                voteParams.title = $('#edit-report-title-field').val();
                voteParams.comment = $('#edit-report-description-field').val().replace(/\r?\n/g, '<br>');
                voteParams.public = $('#edit-feedback-public').is(':checked');

                let submitUrl = EDIT_FEEDBACK_API_URL.replace("{id}", voteParams.id);

                ajaxRequest('PUT', submitUrl, voteParams, function () {
                    enableAndRemoveSpin('#edit-report-submit');

                    $('edit-report-submit-status').text("Complete.");
                    $('edit-report-submit-status').text("");

                    $('#edit-report-modal').modal('hide');
                });
            },
            error: function (e) {
                // TODO: Do more helpful stuff, probably still submit the text feedback
                $("#result").text(e.responseText);
                console.log("ERROR : ", e);
                $("#edit-report-submit").attr("disabled", false);
            }
        });
    }

    function setupEditModal(feedback) {
        $('#edit-report-header').text("Modify your feedback");

        console.log(feedback);

        $('#edit-report-id-field').val(feedback.id);
        $('#edit-report-title-field').val(feedback.title);
        $('#edit-report-description-field').val(feedback.comment);

        $('#edit-feedback-public').attr('checked', feedback.public)
        $('#edit-report-attachment-group').show();


        $('#edit-report-submit').off();
        $('#edit-report-submit').click(function () {
            
            $('#edit-report-submit').attr('disabled', true);

            microsoftTeams.getContext(function (context) {
                let voteParams = {
                    userEmail: context['loginHint'],
                    id: feedback.id,
                    title: $('#edit-report-title-field').val(),
                    comment: $('#edit-report-description-field').val(),
                }
                submitEditReport(event, voteParams);
            });
        });
    }

    // Initialize table
    microsoftTeams.getContext(function (context) {
        let email = context["loginHint"];
        //let email = 

        var myFeedbackTable, otherFeedbackTable;

        $('#view-feedback-modal').on('shown.bs.modal', function (e) {
            $('#caseId').text(e.relatedTarget.id.replace("view-feedback-", ""));
            $('#caseTitle').text($(e.relatedTarget).data("title"));

            function bindEditButtons() {
                $('.edit-existing-feedback').click(function () {
                    var feedback = JSON.parse(b64DecodeUnicode($(this).data('feedback')));

                    $('#edit-report-modal').modal('show');
                    setupEditModal(feedback);
                });

                $('.scenario-feedback-public-checkbox').change(function () {
                    let feedbackId = parseInt(this.id.replace("scenario-feedback-public-", ""));
                    let updateUrl = EDIT_FEEDBACK_API_URL.replace("{id}", feedbackId);
                    let params = {
                        public: this.checked,
                        submitterEmail: email,
                    };

                    ajaxRequest('PUT', updateUrl, params, function () {
                        console.log("Done");
                    });
                });
            }

            function bindVoteButtons() {
                $('.upvote-feedback').off();
                $('.upvote-feedback').click(function () {
                    console.log("Clicked an upvote button");
                    let id = this.id.replace("upvote-feedback-", "");

                    let voteUrl = UPVOTE_API_URL.replace("{id}", id);
                    let voteParams = {
                        email: email,
                    };

                    ajaxRequest('POST', voteUrl, voteParams, function () {
                        console.log("Done");
                        $(otherFeedbackTable).dataTable().api().ajax.reload();
                    });
                });

                $('.comment-feedback').off();
                $('.comment-feedback').click(function () {
                    let id = this.id.replace("comment-feedback-", "");
                    console.log(id);

                    // Show the comment modal
                    $('#feedback-comment-modal').modal('show');

                    $('#feedback-comment-submit').off();
                    $('#feedback-comment-submit').click(function () {
                        disableAndSpin('#feedback-comment-submit');

                        $('#feedback-comment-id').text(id);

                        let commentUrl = COMMENT_API_URL.replace("{id}", id);
                        let commentParams = {
                            email: email,
                            comment: $('#feedback-comment-field').val()
                        }
                        console.log(commentUrl);
                        ajaxRequest('POST', commentUrl, commentParams, function () {
                            console.log("Done");
                            enableAndRemoveSpin('#feedback-comment-submit');
                            $('#feedback-comment-field').val("")
                            $('#feedback-comment-modal').modal('hide');

                        });

                    })
                });
            }

            myFeedbackTable = $('#your-scenario-feedback-table').DataTable({
                //dom: '<"toolbar">frtip',
                info: false,
                paging: false,
                //searching: false,
                //ordering: false,
                autoWidth: false,
                ajax: {
                    url: "/api/feedback/scenario/mine",
                    type: "POST",
                    contentType: "application/json",
                    data: function (d) {
                        let caseId = $('#caseId').text();
                        return JSON.stringify({
                            caseId: caseId,
                            userEmail: email,
                        });
                    },
                    dataSrc: "feedback",
                },
                columns: [
                    { "data": "id" },
                    { "data": "type" },
                    { "data": "title" },
                    { "data": "state" },
                    { "data": "reason" },
                    { "data": "public" },
                ],
                columnDefs: [
                    {
                        render: function (data, type, row) {
                            //console.log(row);
                            if (row.publicId) {
                                return `<span style="font-size: 9px;">${row.publicId}</span>`;
                            } else {
                                return `<span style="font-size: 9px;">${row.id}</span>`;
                            }

                        },
                        targets: 0,
                    },
                    {
                        render: function (data, type, row) {
                            let id = row._id || row.id;

                            // data-toggle="modal", data-target="#view-feedback-modal
                            let cell;
                            if (id == "?") {
                                cell = data;
                            } else {
                                cell = '<a data-feedback=' + b64EncodeUnicode(JSON.stringify(row)) + ' class="edit-existing-feedback" id="feedback-text-' + id + '">' + data + '</span>';
                            }
                            
                            return cell;
                        },
                        targets: 2
                    },
                    {
                        render: function (data, type, row) {
                            let id = row._id || row.id;
                            if (data == true) {
                                return "<input type='checkbox' checked class='scenario-feedback-public-checkbox' id='scenario-feedback-public-" + id + "'></input>";
                            } else {
                                return "<input type='checkbox' class='scenario-feedback-public-checkbox' id='scenario-feedback-public-" + id + "'></input>";
                            }
                        },
                        targets: 5
                    }
                ],
                initComplete: bindEditButtons,
            });

            otherFeedbackTable = $('#other-scenario-feedback-table').DataTable({
                info: false,
                paging: false,
                //searching: false,
                //ordering: false,
                autoWidth: false,
                ajax: {
                    url: "/api/feedback/scenario/public",
                    type: "POST",
                    contentType: "application/json",
                    data: function (d) {
                        let caseId = $('#caseId').text();
                        return JSON.stringify({
                            caseId: caseId,
                            userEmail: email,
                        });
                    },
                    dataSrc: "feedback",
                },
                columns: [
                    { "data": "id" },
                    {},
                    {},
                    { "data": "title" },
                    { "data": "state" },
                    { "data": "reason" },
                    {},
                ],
                columnDefs: [
                    {
                        render: function (data, type, row) {
                            if ((row.publicId) && (row.id)) {
                                return `<span style="font-size: 9px;">${row.publicId} - ${row.id}</span>`;
                            } else if (row.publicId) {
                                return `<span style="font-size: 9px;">${row.publicId}</span>`;
                            } else {
                                return `<span style="font-size: 9px;">${row.id}</span>`;
                            }

                        },
                        targets: 0,
                    },

                    {
                        render: function (data, type, row) {
                            if (row.public) {
                                let id = row.id;

                                let upvoteCount = row.upvotes ? row.upvotes.length : 0;

                                let statusClass = "";
                                let disabled = "";
                                if (row.userUpvoted) {
                                    statusClass = "active";
                                    disabled = "disabled";
                                }

                                let cell = "<button class='btn btn-minor upvote-feedback " + statusClass + "'" + disabled + " id='upvote-feedback-" + id + "'><i class='fa fa-thumbs-up' title='Upvote'></i> " + upvoteCount + "</button>"
                                return cell;
                            } else {
                                return "";
                            }

                        },
                        targets: 1
                    },
                    
                    {
                        render: function (data, type, row) {
                            if (row.public) {
                                let id = row.id;

                                let cell = "<button class='btn btn-minor comment-feedback' id='comment-feedback-" + id + "'><i class='fa fa-comment' title='Comment'></i></button>"
                                return cell;
                            } else {
                                return "";
                            }

                        },
                        targets: 2
                    },
                    {
                        render: function (data, type, row) {
                            if (row.userEmail) {
                                console.log("Showing submitter column");
                                $('.submitterColumn').show();
                                return row.userEmail;
                            } else if (row.email) {
                                console.log("Showing submitter column");

                                $('.submitterColumn').show();
                                return row.email;
                            } else {

                                return "";
                            }
                        },
                        targets: 6
                    }
                    
                ],
                initComplete: bindVoteButtons
            });
        });


        $('#view-feedback-modal').on('hidden.bs.modal', function (e) {
            if (myFeedbackTable) {
                myFeedbackTable.clear().destroy();
            }
            if (otherFeedbackTable) {
                otherFeedbackTable.clear().destroy();
            }
        });

        $('#edit-report-modal').on('hidden.bs.modal', function (e) {
            $('#edit-report-title-field').val("");
            $('#edit-report-description-field').val("");
            $('#edit-report-file').val("");
        });

        $("#feedback-comment-modal").on('hidden.bs.modal', function (e) {
            $('#feedback-comment-field').val("");
        });

        $(window).keydown(function (event) {
            // Prevent glitchy "submit form" behavior on pressing enter
            if (event.keyCode == 13) {
                event.preventDefault();
                return false;
            }
        });
    });
});