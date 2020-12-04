$(document).ready(function () {
    const FEEDBACK_API_URL = "../api/validations/feedback";
    const UPVOTE_API_URL = "../api/feedback/{id}/upvote";

    console.log("Hello");
    microsoftTeams.initialize();

    console.log("ScenarioFeedbackController ready");

    var feedbackField = $('#feedbackField');
    var submitFeedback = $('#submitFeedback');
    var feedbackPublicField = $('#feedbackPublicField');

    function submitEditReport(event, voteParams) {
        //stop submit the form, we will post it manually.
        event.preventDefault();

        // Get form
        var form = $('#edit-report-form')[0];

        // Create an FormData object
        var data = new FormData(form);

        console.log(data);

        // disable the submit button
        $("#edit-report-submit").attr("disabled", true);
        $("#edit-report-submit").html(spinner + $('#edit-report-submit').text());

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

                voteParams.attachments = data.files;

                voteParams.title = $('#edit-report-title-field').val();
                voteParams.comment = $('#edit-report-description-field').val().replace(/\r?\n/g, '<br>');
                voteParams.public = $('#edit-feedback-public').is(':checked');

                let submitUrl = "../api/feedback/scenario/" + voteParams.id;

                ajaxRequest('PUT', submitUrl, voteParams, function () {
                    $("#edit-report-submit").attr("disabled", false);

                    $("#edit-report-submit").text($('#edit-report-submit').html().replace(spinner, ""));

                    // TEMP: Disabling for easier testing
                    $('#edit-report-modal').modal('hide');
                });

                $("#edit-report-submit").attr("disabled", false);
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
        console.log(feedback);
        $('#edit-report-id-field').val(feedback.id);
        $('#edit-report-title-field').val(feedback.title);
        $('#edit-report-description-field').val(feedback.comment);

        $('#edit-feedback-public').attr('checked', feedback.public)

        $('#edit-report-submit').off();
        $('#edit-report-submit').click(function () {
            $('#edit-report-submit').attr('disabled', true);

            microsoftTeams.getContext(function (context) {
                let voteParams = {
                    userEmail: context['userPrincipalName'],
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

        var myFeedbackTable, otherFeedbackTable;

        $('#view-feedback-modal').on('shown.bs.modal', function (e) {
            $('#caseId').text(e.relatedTarget.id.replace("view-feedback-", ""));
            console.log($(e.relatedTarget).data("caseTitle"));
            $('#caseTitle').text($(e.relatedTarget).data("caseTitle"));

            function bindEditButtons() {
                console.log("Called bindEditButtons");
                $('.edit-existing-feedback').click(function () {
                    console.log("Clicked edit exisitng feedback button");
                    console.log(this);
                    var feedback = JSON.parse(b64DecodeUnicode($(this).data('feedback')));

                    $('#view-feedback-modal').modal('hide');
                    $('#edit-report-modal').modal('show');
                    setupEditModal(feedback);
                })
            }

            function bindVoteButtons() {
                console.log("Called bindVoteButtons");
                $('.upvote-feedback').click(function () {
                    console.log("Clicked an upvote button");
                    let id = this.id.replace("upvote-feedback-", "");
                    console.log(id);

                    let voteUrl = UPVOTE_API_URL.replace("{id}", id);
                    let voteParams = {
                        email: context['userPrincipalName']
                    };

                    console.log(voteParams);

                    ajaxRequest('POST', voteUrl, voteParams, function () {
                        console.log("Done");
                        $(otherFeedbackTable).dataTable().api().ajax.reload();
                    });
                });

                $('.comment-feedback').click(function () {
                    console.log("Clicked a comment button");
                    let id = this.id.replace("comment-feedback-", "");
                    console.log(id);
                    // TODO: Need some sort of new interface for entering a comment. Another modal?
                });
            }

            myFeedbackTable = $('#your-scenario-feedback-table').DataTable({
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
                        console.log("Getting data");
                        return JSON.stringify({
                            caseId: caseId,
                            userEmail: context["userPrincipalName"],
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
                            let id = row._id;

                            // data-toggle="modal", data-target="#view-feedback-modal

                            let cell = '<a data-toggle="modal", data-feedback=' + b64EncodeUnicode(JSON.stringify(row)) + ' class="edit-existing-feedback" id="feedback-text-' + id + '">' + data + '</span>';
                            return cell;
                        },
                        targets: 2
                    },
                    {
                        render: function (data, type, row) {
                            let id = row._id;
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
                        console.log("Getting data");
                        return JSON.stringify({
                            caseId: caseId,
                            userEmail: context["userPrincipalName"],
                        });
                    },
                    dataSrc: "feedback",
                },
                columns: [
                    { "data": "id" },
                    {},
                    //{},
                    { "data": "title" },
                ],
                columnDefs: [
                    {
                        render: function (data, type, row) {
                            let id = row.id;
                            console.log(row);
                            console.log(id);

                            let upvoteCount = row.upvotes ? row.upvotes.length : 0;

                            console.log(row.upvotes);

                            let statusClass = "";
                            if (row.userUpvoted) {
                                statusClass = "active";
                            }

                            let cell = "<button class='btn btn-minor upvote-feedback " + statusClass + "' id='upvote-feedback-" + id + "'><i class='fa fa-thumbs-up' title='Upvote'></i> " + upvoteCount + "</button>"
                            return cell;
                        },
                        targets: 1
                    },
                    /*
                    {
                        render: function (data, type, row) {
                            let id = row.id;

                            let cell = "<button class='btn btn-minor comment-feedback' id='comment-feedback-" + id+ "'><i class='fa fa-comment' title='Comment'></i></button>"
                            return cell;
                        },
                        targets: 2
                    }
                    */
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
        });
    });
});