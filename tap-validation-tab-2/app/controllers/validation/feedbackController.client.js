$(document).ready(function () {
    const FEEDBACK_API_URL = "../api/validations/feedback";

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
            console.log("Called bindEditButtons");
            $('.edit-feedback').click(function () {
                let feedbackId = parseInt(this.id.replace("edit-feedback-", ""));
                let feedbackText = $('#feedback-text-' + feedbackId);
                let originalText = feedbackText.html().replace(/\r?\n/g, '<br>');
                console.log(feedbackId);
                feedbackText.attr("contenteditable", "plaintext-only");
                console.log(originalText);

                feedbackText.on('keydown', function (e) {
                    if (e.keyCode == 13) {
                        fixLineBreak();

                        e.preventDefault();
                    }
                });

                feedbackText.css("background-color", "white");
                feedbackText.focus();

                // When navigating away from it, save the changes to the text
                feedbackText.off();
                feedbackText.blur(function () {
                    console.log("Blurred it");

                    let text = feedbackText.html().replace(/\r?\n/g, '<br>');
                    feedbackText.html(text);

                    if (text != originalText) {
                        let url = '/api/feedback/' + feedbackId;
                        let params = {
                            text: text,
                            submitterEmail: context['userPrincipalName'],
                        };

                        ajaxRequest('PUT', url, params, function (err, resp, body) {
                            console.log("Done");
                        });
                    } else {
                        console.log("Not different");
                    }
                    feedbackText.attr('contenteditable', false);
                    feedbackText.css("background-color", '');
                });

            });

            $('.feedback-public-checkbox').change(function () {
                console.log(this);
                let feedbackId = parseInt(this.id.replace("feedback-public-", ""));
                console.log(feedbackId, this.checked);
                let url = '/api/feedback/' + feedbackId;
                let params = {
                    public: this.checked,
                    submitterEmail: context['userPrincipalName'],
                };

                ajaxRequest('PUT', url, params, function (err, resp, body) {
                    console.log(resp);
                    console.log("Done");
                })
            });
        }

        var feedbackTable = $('#your-feedback-table').DataTable({
            info: false,
            paging: false,
            searching: false,
            ordering: false,
            autoWidth: false,
            ajax: {
                url: "/api/feedback",
                type: "POST",
                contentType: "application/json",
                data: function (d) {
                    return JSON.stringify({
                        validationId: config.validationId,
                        userEmail: context["userPrincipalName"],
                    });
                },
                dataSrc: "feedback",
            },
            columns: [
                { "data": "_id" },
                { "data": "text" },
                { "data": "state" },
                { "data": "reason" },
                { "data": "public" },
            ],
            columnDefs: [
                {
                    render: function (data, type, row) {
                        let id = row._id;

                        let cell = "<i class='fa fa-pencil-alt edit-feedback' id='edit-feedback-" + row._id + "' title='Edit feedback'></i> " + '<span class="feedback-text editable-text" id="feedback-text-' + id + '">' + data + '</span>';
                        return cell;
                    },
                    targets: 1
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
                    targets: 4
                }
            ],
            initComplete: bindEditButtons,
        });

        console.log(feedbackTable);

        var otherFeedbackTable = $('#feedback-table').DataTable({
            info: false,
            paging: false,
            searching: false,
            ordering: false,
            ajax: {
                url: "/api/feedback/public",
                type: "POST",
                contentType: "application/json",
                data: function (d) {
                    return JSON.stringify({
                        validationId: config.validationId,
                        userEmail: context["userPrincipalName"],
                    });
                },
                dataSrc: "feedback",
            },
            columns: [
                { "data": "_id" },
                { "data": "text" },
            ],
            columnDefs: [
                {
                    "render": function (data, type, row) {
                        let cell = '<i>"' + data + '"</i>';
                        // TODO: Taking this out for now
                        //if (row.showEditButton) {
                        //    cell = "<i class='fa fa-pencil-alt edit-feedback' id='edit-feedback-" + row._id + "'></i>  " + cell;
                        // }
                        return cell;
                    },
                    "targets": 1
                },
            ],
            initComplete: bindEditButtons,
        });

        // Refresh table when modal is launched
        $('#feedback-modal').on('shown.bs.modal', function (e) {
            feedbackTable.ajax.reload(bindEditButtons);
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

                feedbackTable.ajax.reload(bindEditButtons);
                console.log("Done");
            });

        });

        $('#feedback-modal').on('hidden.bs.modal', function (e) {
            // Takedown of state/fields when modal closes
            $('#submitFeedback').attr('disabled', false);
            $('#feedback-title-field').val("");
            $('#feedback-description-field').val("");
        });
    });
});