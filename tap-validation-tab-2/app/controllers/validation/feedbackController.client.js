$(document).ready(function () {
    const FEEDBACK_API_URL = "../api/feedback";
    const EDIT_FEEDBACK_API_URL = "../api/feedback/{id}";
    const UPVOTE_API_URL = "/api/feedback/{id}/upvote";
    const COMMENT_API_URL = "/api/feedback/{id}/comment";
    const USER_FEEDBACK_API_URL = "/api/feedback/mine";
    const OTHER_FEEDBACK_API_URL = "/api/feedback/public";

    console.log("Hello");
    microsoftTeams.initialize();

    console.log("FeedbackController ready");

    var feedbackField = $('#feedbackField');
    var submitFeedback = $('#submitFeedback');
    var feedbackPublicField = $('#feedbackPublicField');

    // Initialize table
    microsoftTeams.getContext(function (context) {

        // This gets run after the table refreshes
        function bindEditButtons() {
            $('.edit-existing-feedback').click(function () {
                var feedback = JSON.parse(b64DecodeUnicode($(this).data('feedback')));

                $('#edit-report-modal').modal('show');
                setupEditModal(feedback);
            });

            $('.feedback-public-checkbox').change(function () {
                let feedbackId = parseInt(this.id.replace("feedback-public-", ""));
                let updateUrl = EDIT_FEEDBACK_API_URL.replace("{id}", feedbackId);
                let params = {
                    public: this.checked,
                    submitterEmail: context['userPrincipalName'],
                };

                ajaxRequest('PUT', updateUrl, params, function () {
                    console.log("Done");
                });
            });
        }

        function bindVoteButtons() {
            console.log("Called bindVoteButtons");
            $('.upvote-general-feedback').off();
            $('.upvote-general-feedback').click(function () {
                console.log("Clicked an upvote button");
                let id = this.id.replace("upvote-general-feedback-", "");

                let voteUrl = UPVOTE_API_URL.replace("{id}", id);
                let voteParams = {
                    email: context['userPrincipalName']
                };

                ajaxRequest('POST', voteUrl, voteParams, function () {
                    console.log("Done");
                    $(otherFeedbackTable).dataTable().api().ajax.reload();
                });
            });

            $('.comment-general-feedback').off();
            $('.comment-general-feedback').click(function () {
                let id = this.id.replace("comment-general-feedback-", "");
                console.log(id);

                // Show the comment modal
                $('#feedback-comment-modal').modal('show');

                $('#feedback-comment-submit').off();
                $('#feedback-comment-submit').click(function () {
                    disableAndSpin('#feedback-comment-submit');

                    $('#feedback-comment-id').text(id);

                    let commentUrl = COMMENT_API_URL.replace("{id}", id);
                    let commentParams = {
                        email: context['userPrincipalName'],
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

        function setupEditModal(feedback) {
            console.log(feedback);
            let safeDescription = feedback.text.replace(/<br>/g, "\n");
            $('#edit-report-header').text("Modify your feedback");
            console.log(safeDescription);
            $('#edit-report-id-field').val(feedback._id);
            $('#edit-report-title-field').val(feedback.title);
            $('#edit-report-description-field').val(safeDescription);

            $('#edit-feedback-public').attr('checked', feedback.public)
            $('#edit-report-attachment-group').show();


            $('#edit-report-submit').off();
            $('#edit-report-submit').click(function () {

                $('#edit-report-submit').attr('disabled', true);

                microsoftTeams.getContext(function (context) {
                    let voteParams = {
                        userEmail: context['userPrincipalName'],
                        id: feedback._id,
                        title: $('#edit-report-title-field').val(),
                        text: $('#edit-report-description-field').val(),
                    }
                    submitEditReport(event, voteParams);
                });
            });
        }

        function submitEditReport(event, voteParams) {
            //stop submit the form, we will post it manually.
            event.preventDefault();

            // Get form
            var form = $('#edit-report-form')[0];

            // Create an FormData object
            var data = new FormData(form);

            // disable the submit button
            disableAndSpin('#edit-report-submit');

            $('#edit-report-submit-status').text("Uploading...");

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

                    $('#edit-report-submit-status').text("Submitting...");


                    voteParams.attachments = data.files;

                    voteParams.title = $('#edit-report-title-field').val();
                    voteParams.comment = $('#edit-report-description-field').val().replace(/\r?\n/g, '<br>');
                    voteParams.public = $('#edit-feedback-public').is(':checked');

                    let submitUrl = EDIT_FEEDBACK_API_URL.replace("{id}", voteParams.id);

                    ajaxRequest('PUT', submitUrl, voteParams, function () {
                        enableAndRemoveSpin('#edit-report-submit');
                        $('#edit-report-submit-status').text("Done");
                        $('#edit-report-submit-status').text("");

                        $('#edit-report-modal').modal('hide');

                        myFeedbackTable.ajax.reload(bindEditButtons);
                    });

                    //$("#edit-report-submit").attr("disabled", false);
                },
                error: function (e) {
                    // TODO: Do more helpful stuff, probably still submit the text feedback
                    $("#result").text(e.responseText);
                    $('#feedback-submit-stauts').text("Error: " + e.responseText);
                    console.log("ERROR : ", e);
                    enableAndRemoveSpin('#edit-report-submit');
                }
            });
        }

        var myFeedbackTable = $('#your-feedback-table').DataTable({
            info: false,
            paging: false,
            //searching: false,
            //ordering: false,
            autoWidth: false,
            ajax: {
                url: USER_FEEDBACK_API_URL,
                type: "GET",
                contentType: "application/json",
                data: {
                    validationId: config.validationId,
                    userEmail: context["userPrincipalName"]
                },
                dataSrc: "feedback",
            },
            columns: [
                { "data": "_id" },
                { "data": "title" },
                { "data": "text" },
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

                        let cell;
                        if (id == "?") {
                            cell = data;
                        } else {
                            //cell = data;
                            cell = '<a data-feedback=' + b64EncodeUnicode(JSON.stringify(row)) + ' class="edit-existing-feedback" id="feedback-text-' + id + '">' + data + '</span>';
                        }

                        return cell;
                    },
                    targets: 1
                },
                {
                    render: function (data, type, row) {
                        let id = row._id || row.id;
                        if (data == true) {
                            return "<input type='checkbox' checked class='feedback-public-checkbox' id='feedback-public-" + id + "'></input>";
                        } else {
                            return "<input type='checkbox' class='feedback-public-checkbox' id='feedback-public-" + id + "'></input>";
                        }
                    },
                    targets: 5
                }
            ],
            initComplete: bindEditButtons,
        });

        var otherFeedbackTable = $('#feedback-table').DataTable({
            info: false,
            paging: false,
            //searching: false,
            //ordering: false,
            ajax: {
                url: OTHER_FEEDBACK_API_URL,
                type: "GET",
                contentType: "application/json",
                data: {
                        validationId: config.validationId,
                        userEmail: context["userPrincipalName"],
                },

                dataSrc: "feedback",
            },
            columns: [
                { "data": "_id" },
                {},
                {},
                { "data": "title" },
                { "data": "text" },
                { "data": "state" },
                { "data": "reason" },
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
                        let id = row.id || row._id;

                        let upvoteCount = row.upvotes ? row.upvotes.length : 0;

                        let statusClass = "";
                        let disabled = "";
                        if (row.userUpvoted) {
                            statusClass = "active";
                            disabled = "disabled";
                        }

                        let cell = "<button class='btn btn-minor upvote-general-feedback " + statusClass + "'" + disabled + " id='upvote-general-feedback-" + id + "'><i class='fa fa-thumbs-up' title='Upvote'></i> " + upvoteCount + "</button>"
                        return cell;
                    },
                    targets: 1
                },

                {
                    render: function (data, type, row) {
                        let id = row.id || row._id;

                        let cell = "<button class='btn btn-minor comment-general-feedback' id='comment-general-feedback-" + id + "'><i class='fa fa-comment' title='Comment'></i></button>"
                        return cell;
                    },
                    targets: 2
                }

            ],
            initComplete: bindVoteButtons,
        });

        // Refresh table when modal is launched
        $('#feedback-modal').on('shown.bs.modal', function (e) {
            myFeedbackTable.ajax.reload(bindEditButtons);
        });

        $('.feedback-field').off();
        $('.feedback-field').on('change input', function (e) {
            let title = $('#feedback-title-field').val();
            let description = $('#feedback-description-field').val();
            if (title && description) {
                console.log("All required fields filled in");
                $('#submitFeedback').attr('disabled', false);
            }
        });


        $('#submitFeedback').click(function () {
            disableAndSpin('#submitFeedback');

            // Get form
            var form = $('#feedback-form')[0];

            // Create an FormData object
            var data = new FormData(form);

            let safeTitle = $('#feedback-title-field').val();
            let safeDescription = $('#feedback-description-field').val().replace(/\r?\n/g, '<br>');

            console.log(safeTitle);
            console.log($('#feedback-title-field').val());

            let feedbackParams = {
                validationId: config.validationId,
                title: safeTitle,
                text: safeDescription,
                submitterEmail: context['userPrincipalName'],
                public: feedbackPublicField.is(':checked'),
            };

            var windowsBuildTypeField = $('#windowsBuildType');
            var windowsBuildVersionField = $('#windowsBuildVersion');

            feedbackParams.windowsBuildType = windowsBuildTypeField.val();
            feedbackParams.windowsBuildVersion = windowsBuildVersionField.val();

            feedbackParams.attachmentFilenames = [];

            $('#feedback-submit-status').text("Uploading...");

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

                    $('#feedback-submit-status').text("Submitting...");

                    feedbackParams.attachments = data.files;

                    let submitUrl = FEEDBACK_API_URL;

                    console.log(feedbackParams);

                    ajaxRequest('POST', submitUrl, feedbackParams, function () {
                        enableAndRemoveSpin("#submitFeedback");
                        $('#feedback-modal').modal('hide');

                        $('#feedback-submit-status').text("Success");
                        $('#feedback-submit-status').text("");


                        // TODO: Reset form

                    });
                },
                error: function (e) {
                    // TODO: Do more helpful stuff, probably still submit the text feedback
                    $("#result").text(e.responseText);
                    console.log("ERROR : ", e);
                    $('#feedback-submit-status').text("Error: " + e.responseText);
                    enableAndRemoveSpin('#submitFeedback');
                }
            });
        });

        /*
        submitFeedback.click(function () {
            submitFeedback.html(spinner + submitFeedback.html());
            submitFeedback.attr('disabled', true);

            let safeTitle = $('#feedback-title-field').val();
            let safeDescription = $('#feedback-description-field').val().replace(/\r?\n/g, '<br>');

            let feedbackParams = {
                validationId: config.validationId,
                title: safeTitle,
                text: safeDescription,
                submitterEmail: context['userPrincipalName'],
                public: feedbackPublicField.is(':checked'),
            };


            ajaxRequest('POST', FEEDBACK_API_URL, feedbackParams, function () {
                feedbackField.val("");
                submitFeedback.attr('disabled', true);
                $("#submitFeedback").text($('#submitFeedback').html().replace(spinner, ""));
                $('#feedback-modal').modal('hide');
                //$('#feedback-alert').show();

                myFeedbackTable.ajax.reload(bindEditButtons);
                console.log("Done");
            });

        });
        */

        $('#feedback-modal').on('hidden.bs.modal', function (e) {
            // Takedown of state/fields when modal closes
            $('#submitFeedback').attr('disabled', false);
            $('#feedback-title-field').val("");
            $('#feedback-description-field').val("");
            $('#feedback-file').val("");
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