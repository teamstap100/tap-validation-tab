'use strict';

(function () {
    var apiUrl = "/api/bugs/report";


    $().ready(function () {
        function resetReport() {
            console.log("Called resetReport")
            $('#report-submit-status').text("");
            $('#report-title-field').val("");
            $('#report-description-field').val("");
            $('#report-file').val("");
        };

        function checkTitleAndDescription() {
            if ($('#report-title-field').val() && $('#report-description-field').val()) {
                $('#report-submit').attr('disabled', false);
            } else {
                $('#report-submit').attr('disabled', true);

            }
        }

        $('#report-title-field').on('input', checkTitleAndDescription);
        $('#report-description-field').on('input', checkTitleAndDescription);

        function submitReport(event, reportParams) {
            //stop submit the form, we will post it manually.
            event.preventDefault();

            // Get form
            var form = $('#report-form')[0];

            // Create an FormData object
            var data = new FormData(form);

            // If you want to add an extra field for the FormData
            //data.append("comment", $('#report-description-field').text());
            data.append("comment", $('#report-description-field').val().replace(/\r?\n/g, '<br>'));

            // disable the submit button
            disableAndSpin('#report-submit');

            $('#report-submit-status').text("Uploading...");

            reportParams.attachmentFilenames = [];

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

                    $('#report-submit-status').text("Submitting feedback...");

                    reportParams.attachments = data.files;

                    reportParams.title = $('#report-title-field').val();
                    //reportParams.reproSteps = $('#report-repro-steps-field').val().replace(/\r?\n/g, '<br>');
                    reportParams.comment = $('#report-description-field').val().replace(/\r?\n/g, '<br>');

                    ajaxRequestWithToken('POST', apiUrl, reportParams, function () {
                        enableAndRemoveSpin("#report-submit");

                        $('#report-submit-status').text("Complete");
                        $('#report-submit-status').text("");

                        resetReport();
                    });

                    //$("#report-submit").attr("disabled", false);
                },
                error: function (e) {
                    // TODO: Do more helpful stuff, probably still submit the text feedback
                    $("#result").text(e.responseText);
                    $('#report-submit-status').text("Error: " + e.responseText);
                    console.log("ERROR : ", e);
                    enableAndRemoveSpin('#report-submit');
                    $('#success').show();
                }
            });
        }

        $('#report-submit').click(function () {
            $('#report-submit').attr('disabled', true);
            var reportParams = {};
            submitReport(event, reportParams);
        });
    });

})();