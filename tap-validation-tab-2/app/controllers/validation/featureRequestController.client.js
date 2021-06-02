'use strict';

const ADD_FREQ_API_URL = "../api/featureRequests";
const EDIT_FREQ_API_URL = "../api/featureRequests/{id}";

var setupFeatureRequests = function(context) {

    console.log("Called setupFeatureRequests");

    microsoftTeams.getContext(function (context) {


        var titleField = $('#featureRequestTitleField');
        var descriptionField = $('#featureRequestDescriptionField');
        var submitFeatureRequest = $('#submitFeatureRequest');
        var featureRequestPublicField = $('#featureRequestsPublicField');

        var featureRequests = $('.feedback-upvote');

        showExisitngFeatureRequestSupports();

        $('#featureRequestDescriptionField').unbind("keyup");
        $("#featureRequestDescriptionField").keyup(function (event) {
            var keycode = (event.keyCode ? event.keyCode : event.which);
            if (keycode == 13) {
                var s = $(this).val();
                $(this).val(s + "\n");  //\t for tab
            }
        });

        $('.btn-feedback-upvote').click(function () {
            let id = this.id.replace("feature-request-btn-", "");
            //console.log(id);
            let url = `/api/featureRequests/upvote/${id}`;
            let params = { userEmail: context['loginHint'] };

            ajaxRequest('POST', url, params, function (resp) {
                //console.log(resp);
                let score = parseInt($('#feature-request-score-' + id).text());
                score++;
                //console.log(score);
                $('#feature-request-score-' + id).text(score);
                $('#feature-request-btn-' + id).attr('disabled', true);
            
            });
        })

        // Get all the feature requests this user has already supported
        function showExisitngFeatureRequestSupports() {
            let url = `/api/featureRequests/supports?email=${context['loginHint']}&validationId=${config.validationId}`;
            //console.log(url);
            ajaxRequest('GET', url, {}, function (resp) {
                //console.log(resp);
                if (resp) {
                    resp = JSON.parse(resp);
                    //console.log(resp);
                    resp.featureRequests.forEach(function (freq) {
                        //console.log(freq._id);
                        $('#feature-request-btn-' + freq._id).attr('disabled', true);
                    });
                }
            });
        }

        function submitEditFreqReport(event, voteParams) {
            voteParams.title = $('#edit-report-title-field').val();
            voteParams.comment = $('#edit-report-description-field').val().replace(/\r?\n/g, '<br>');
            voteParams.public = $('#edit-feedback-public').is(':checked');

            let submitUrl = EDIT_FREQ_API_URL.replace("{id}", voteParams._id);
            disableAndSpin('#edit-report-submit');

            ajaxRequest('PUT', submitUrl, voteParams, function () {
                enableAndRemoveSpin('#edit-report-submit');

                $('#edit-report-modal').modal('hide');
                featureRequestTable.ajax.reload(bindEditButtons);
            });
        }

        function setupEditFreqModal(freq) {
            console.log("Setting up the edit modal");
            $('#edit-report-header').text("Modify your feature request");

            $('#edit-report-id-field').val(freq._id);
            $('#edit-report-title-field').val(freq.title);
            $('#edit-report-description-field').val(freq.description);

            $('#edit-report-attachment-group').hide();

            $('#edit-feedback-public').attr('checked', freq.public)

            $('#edit-report-submit').off();
            $('#edit-report-submit').click(function () {

                $('#edit-report-submit').attr('disabled', true);

                microsoftTeams.getContext(function (context) {
                    let voteParams = {
                        userEmail: context['loginHint'],
                        _id: freq._id,
                        title: $('#edit-report-title-field').val(),
                        description: $('#edit-report-description-field').val(),
                    }
                    submitEditFreqReport(event, voteParams);
                });
            });
        }

    // This gets run after the table refreshes
    function bindEditButtons() {
        console.log("Called bindEditButtons");

        /*
        ['title', 'description'].forEach(function (prop) {
            $('.edit-featureRequest-' + prop).click(function () {
                let featureRequestId = parseInt(this.id.replace("edit-featureRequest-" + prop + "-", ""));
                let textField = $('#featureRequest-' + prop + '-' + featureRequestId);
                let original = textField.html().replace(/\r?\n/g, '<br>');
                console.log(featureRequestId);
                textField.attr("contenteditable", "plaintext-only");

                textField.on('keydown', function (e) {
                    if (e.keyCode == 13) {
                        fixLineBreak();

                        e.preventDefault();
                    }
                });

                textField.css("background-color", "white");
                textField.focus();

                // When navigating away from it, save the changes to the text
                textField.off();
                textField.blur(function () {
                    console.log("Blurred it");

                    let textInput = textField.html().replace(/\r?\n/g, '<br>');
                    textField.html(textInput);

                    if (textInput != original) {
                        let url = '/api/featureRequests/' + featureRequestId;
                        let params = {
                            submitterEmail: context['loginHint'],
                        };

                        params[prop] = textInput;

                        ajaxRequest('PUT', url, params, function (resp) {
                            console.log("Done");
                        });
                    } else {
                        console.log("Not different");
                    }
                    textField.attr('contenteditable', false);
                    textField.css("background-color", '');
                });
            });
        });
        */

        $('.edit-freq').click(function () {
            var freq = JSON.parse(b64DecodeUnicode($(this).data('freq')));
            console.log(freq);

            $('#edit-report-modal').modal('show');
            setupEditFreqModal(freq);
        });


        $('.feature-request-public-checkbox').change(function () {
            console.log(this);
            let featureRequestId = parseInt(this.id.replace("feature-request-public-", ""));
            console.log(featureRequestId, this.checked);
            let url = '/api/featureRequests/' + featureRequestId;
            let params = {
                public: this.checked,
                submitterEmail: context['loginHint'],
            };

            if (this.checked) {
                $('#panel-' + featureRequestId).show();
            } else {
                $('#panel-' + featureRequestId).hide();

            }

            ajaxRequest('PUT', url, params, function (err, resp, body) {
                console.log(resp);
                console.log("Done");
            })
        });
    }

        var featureRequestTable = $('#your-featureRequest-table').DataTable({
            info: false,
            paging: false,
            //searching: false,
            //ordering: false,
            autoWidth: false,
            ajax: {
                url: "/api/featureRequests",
                type: "GET",
                data: {
                    validationId: config.validationId,
                    userEmail: context['loginHint'],
                },
                dataSrc: "featureRequest",
            },
            columns: [
                { "data": "_id" },
                { "data": "title" },
                { "data": "description" },
                { "data": "state" },
                { "data": "reason" },
                { "data": "public" },
            ],
            columnDefs: [
                {
                    render: function (data, type, row) {
                        let id = row._id || row.id;

                        let cell;
                        if (id == "?") {
                            cell = data;
                        } else {
                            //cell = data;
                            cell = '<a data-freq=' + b64EncodeUnicode(JSON.stringify(row)) + ' class="edit-freq" id="freq-text-' + id + '">' + data + '</span>';
                        }

                        return cell;
                    },
                    targets: 1
                },
                {
                    render: function (data, type, row) {
                        let id = row._id;
                        if (data == true) {
                            return "<input type='checkbox' checked class='feature-request-public-checkbox' id='feature-request-public-" + id + "'></input>";
                        } else {
                            return "<input type='checkbox' class='feature-request-public-checkbox' id='feature-request-public-" + id + "'></input>";
                        }
                    },
                    targets: 5
                }
            ],
            initComplete: bindEditButtons,
        });

        // Refresh table when modal is launched
        $('#featureRequest-modal').on('shown.bs.modal', function (e) {
            featureRequestTable.ajax.reload(bindEditButtons);
        });

        titleField.on('input', function (e) {
            if (titleField.val() && descriptionField.val()) {
                submitFeatureRequest.attr('disabled', false);
                submitFeatureRequest.attr('title', "Submit feature suggestion");
            } else {
                submitFeatureRequest.attr('disabled', true);
                submitFeatureRequest.attr('title', "Please enter a title and description.");
            }
        });

        descriptionField.on('input', function (e) {
            if (titleField.val() && descriptionField.val()) {
                submitFeatureRequest.attr('disabled', false);
                submitFeatureRequest.attr('title', "Submit feature suggestion");
            } else {
                submitFeatureRequest.attr('disabled', true);
                submitFeatureRequest.attr('title', "Please enter a title and description.");
            }
        });

        submitFeatureRequest.click(function () {
            console.log("Clicked submit");
            disableAndSpin('#submitFeatureRequest');
            let featureRequestParams = {
                validationId: config.validationId,
                title: titleField.val(),
                description: descriptionField.val().replace(/\r?\n/g, '<br>'),
                submitterEmail: context['loginHint'],
                public: featureRequestPublicField.is(':checked'),
            };

            console.log(featureRequestParams);

            ajaxRequest('POST', ADD_FREQ_API_URL, featureRequestParams, function () {
                titleField.val("");
                descriptionField.val("");
                enableAndRemoveSpin('#submitFeatureRequest');
                $('#featureRequest-alert').show();

                featureRequestTable.ajax.reload(bindEditButtons);
                console.log("Done");
            });

        });
    });
    }