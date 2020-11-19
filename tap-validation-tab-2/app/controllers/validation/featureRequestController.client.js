'use strict';

const FEATURE_REQUEST_API_URL = "../api/validations/featureRequests";

var setupFeatureRequests = function(context) {

    console.log("Hello");

    console.log("Called setupFeatureRequests");

    var titleField = $('#featureRequestTitleField');
    var descriptionField = $('#featureRequestDescriptionField');
    var submitFeatureRequest = $('#submitFeatureRequest');
    var featureRequestPublicField = $('#featureRequestsPublicField');

    var featureRequests = $('.feedback-upvote');

    showExisitngFeatureRequestSupports();

    $('.btn-feedback-upvote').click(function () {
        let id = this.id.replace("feature-request-btn-", "");
        console.log(id);
        let url = '/api/featureRequests/support/' + id;
        let params = {
            userEmail: context["userPrincipalName"]
        };

        ajaxRequest('POST', url, params, function (resp) {
            console.log(resp);
            let score = parseInt($('#feature-request-score-' + id).text());
            score++;
            console.log(score);
            $('#feature-request-score-' + id).text(score);
            $('#feature-request-btn-' + id).attr('disabled', true);
            
        });
    })

    // Get all the feature requests this user has already supported
    function showExisitngFeatureRequestSupports() {
        let url = '/api/featureRequests/supports';
        let params = {
            email: context['userPrincipalName'],
            validationId: config.validationId
        };

        console.log(params);

        ajaxRequest('POST', url, params, function (resp) {
            resp = JSON.parse(resp);
            resp.featureRequests.forEach(function (freq) {
                console.log(freq._id);
                $('#feature-request-btn-' + freq._id).attr('disabled', true);
            });
        });
    }

    // This gets run after the table refreshes
    function bindEditButtons() {
        console.log("Called bindEditButtons");
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
                            submitterEmail: context['userPrincipalName'],
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


        $('.feature-request-public-checkbox').change(function () {
            console.log(this);
            let featureRequestId = parseInt(this.id.replace("feature-request-public-", ""));
            console.log(featureRequestId, this.checked);
            let url = '/api/featureRequests/' + featureRequestId;
            let params = {
                public: this.checked,
                submitterEmail: context['userPrincipalName'],
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
        searching: false,
        ordering: false,
        autoWidth: false,
        ajax: {
            url: "/api/featureRequests",
            type: "POST",
            contentType: "application/json",
            data: function (d) {
                return JSON.stringify({
                    validationId: config.validationId,
                    userEmail: context["userPrincipalName"],
                });
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
                    let id = row._id;

                    let cell = "<i class='fa fa-pencil-alt edit-featureRequest-title edit-featureRequest-pencil' id='edit-featureRequest-title-" + row._id + "' title='Edit title'></i> " + '<span class="featureRequest-title editable-text" id="featureRequest-title-' + id + '">' + data + '</span>';
                    return cell;
                },
                targets: 1
            },
            {
                render: function (data, type, row) {
                    let id = row._id;

                    let cell = "<i class='fa fa-pencil-alt edit-featureRequest-description edit-featureRequest-pencil' id='edit-featureRequest-description-" + row._id + "' title='Edit description'></i> " +  '<span class="featureRequest-description editable-text" id="featureRequest-description-' + id + '">' + data + '</span>';
                    return cell;
                },
                targets: 2
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
        submitFeatureRequest.html(spinner + submitFeatureRequest.html());
        submitFeatureRequest.attr('disabled', true);
        let featureRequestParams = {
            validationId: config.validationId,
            title: titleField.val(),
            description: descriptionField.val().replace(/\r?\n/g, '<br>'),
            submitterEmail: context['userPrincipalName'],
            public: featureRequestPublicField.is(':checked'),
        };

        console.log(featureRequestParams);

        ajaxRequest('POST', FEATURE_REQUEST_API_URL, featureRequestParams, function () {
            titleField.val("");
            descriptionField.val("");
            submitFeatureRequest.attr('disabled', true);
            submitFeatureRequest.html(submitFeatureRequest.html().replace(spinner, ""));
            $('#featureRequest-alert').show();

            featureRequestTable.ajax.reload(bindEditButtons);
            console.log("Done");
        });

    });
    }