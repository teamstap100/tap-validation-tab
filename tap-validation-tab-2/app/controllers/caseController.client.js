'use strict';

(function () {
    var apiUrl = "../api/cases"
    var commentApiUrl = "../api/cases/comments";
    var feedbackApiUrl = "../api/validations/feedback";
    var userPrefsUrlBase = "../api/users/";
    //var deepLinkUrl = "../api/deeplink";
    var updateValidationTabUrlUrl = "../api/validations";
    const spinner = '<i class="fa fa-spinner fa-spin"></i>  ';
    const clientSpinner = '<i class="fa fa-spinner fa-spin client-spin"></i>  ';
    const thumbsUp = '<i class="fa fa-thumbs-up"> </i>';
    const thumbsDown = '<i class="fa fa-thumbs-down"> </i>';

    const MSFT_TENANT_ID = "72f988bf-86f1-41af-91ab-2d7cd011db47";

    var userPrefs = {};

    // TESTING
    //var APP_ID = "b846239c-20f9-452b-b121-8ab17c91b24e";
    //var TAB_URL_BASE = "https%3A%2F%2Fc0e3bd7d.ngrok.io%2Fvalidations%2F";

    // PRODUCTION
    var APP_ID = "28769a3c-0a17-4c2a-a118-680af5e7a8be";
    var TAB_URL_BASE = "https%3A%2F%2Ftap-validation-tab.azurewebsites.net%2Fvalidations%2F";

    var userCleanEmail = "";

    const old_clients = ["windows", "mac", "android", "ios",];
    const clients = ["windows", "mac", "android", "ios", "chrome", "linux"];
    const walkie_clients = ['Samsung XCP', 'Android + Wired H', 'Android + Wireless H'];

    var caseClients = {};

    const HID_ISLANDS_MODE_VALIDATION = "711068";
    const WALKIE_TALKIE_VALIDATION = "767324";

    function getUrlVars() {
        var vars = {};
        var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
            vars[key] = value;
        });
        return vars;
    }

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

    function getUserPrefs(oid) {
        let userPrefsUrl = userPrefsUrlBase + oid;
        ajaxRequest('GET', userPrefsUrl, {}, function (data) {
            console.log("Done");
            console.log(data);
            data = JSON.parse(data);

            if (data.windowsBuildVersion) {
                $('#windowsBuildVersion').val(data.windowsBuildVersion).trigger('change');
            }

            if (data.windowsBuildType) {
                $('#windowsBuildType').val(data.windowsBuildType).trigger('change');
            }

            userPrefs = data;

            return data;
        });
    }

    function setUserPrefs(oid, email) {
        let prefs = {};

        if ($('#windowsBuildType').val()) {
            console.log("Setting windowsBuildType");
            prefs['windowsBuildType'] = $('#windowsBuildType').val();
        }

        if ($('#windowsBuildVersion').val()) {
            console.log("Setting windowsBuildVersion");
            prefs['windowsBuildVersion'] = $('#windowsBuildVersion').val();
        }

        // TODO: Placeholder. Get real inputs for this
        prefs['feedbackPublic'] = true;
        
        let params = {
            oid: oid,
            email: email,
            prefs: prefs,
        }

        let userPrefsUrl = userPrefsUrlBase + oid;
        ajaxRequest('POST', userPrefsUrl, params, function (data) {
            userPrefs = prefs;
            console.log("Set preferences");
        });
    }

    function showScenariosIfWindowsInfoFilled() {
        console.log("Showing scenarios if windows info filled");
        let windowsBuildVersion = $('#windowsBuildVersion').val();
        let windowsBuildType = $('#windowsBuildType').val();
        if (windowsBuildVersion && windowsBuildType) {
            console.log("Value, so enabling buttons");
            $('.btn-upvote').attr('disabled', false);
            $('.btn-downvote').attr('disabled', false);
            $('.btn-comment').attr('disabled', false);

            $('.group-collapse').collapse("show");
            $('.case-collapse').collapse("show");

            microsoftTeams.getContext(function (context) {
                setUserPrefs(context['userObjectId'], cleanEmail(context['userPrincipalName']))
            })

        } else {
            console.log("No value, so disabling buttons");
            $('.btn-upvote').attr('disabled', true);
            $('.btn-downvote').attr('disabled', true);
            $('.btn-comment').attr('disabled', true);
        }
    }

    function refreshGroupVoteCounts() {
        let totalCaseCount = 0;
        let totalVotedCount = 0;
        $('.group-panel').each(function () {
            var caseCount = $(this).find('.case-panel').length;
            var worksCount = $(this).find('.case-works').length;
            var failsCount = $(this).find('.case-fails').length;
            var votedCount = worksCount + failsCount;
            $(this).find('.group-progress').text("Progress: (" + votedCount + " / " + caseCount + ")");


            // TDOO: Not really sure what to do about mixed "all scenarios either work or fail" setions
            if (caseCount <= worksCount) {
                $(this).addClass("section-works");
            }

            if (caseCount <= failsCount) {
                $(this).addClass("section-fails");
            }

            totalVotedCount += worksCount + failsCount;
            totalCaseCount += caseCount;

        });

        // Now count non-grouped scenarios too
        let caseCount = $('.case-panel.ungrouped').length;
        let worksCount = $('.case-works.ungrouped').length;
        let failsCount = $('.case-fails.ungrouped').length;
        let votedCount = worksCount + failsCount;

        totalVotedCount += votedCount;
        totalCaseCount += caseCount;

        $('.validation-progress').text("Scenarios Evaluated: (" + totalVotedCount + " / " + totalCaseCount + ")");
    }

    // Link to a tab needs a djb2 hash of the app ID and the entity ID.
    // This isn't documented anywhere... I got it from an open-source library, source here:
    // https://github.com/ydogandjiev/microsoft-teams-deep-link/blob/master/lib/index.ts

    const deeplinkDjb2Prefix = "_djb2_msteams_prefix_";

    function djb2_hash(str) {
        let hash = 5381;

        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) + hash + str.charCodeAt(i);
        }

        return hash >>> 0; // Ensure positive number
    }


    function resetWindowsReport() {
        // Basic cleanup after submitting or closing Windows 'fails' report
        $('#windows-report-field').val("");
        $('#windows-report-file').val("");

    }

    $(document).ready(function () {
        microsoftTeams.initialize();

        scrollToSubEntity();

        var config = {};

        config.showVector = getUrlVars()["show"];
        if ((config.showVector != null) && (config.showVector != "")) {
            $('.group-panel').each(function (index) {
                if (config.showVector.substring(0, 1) == 0) {
                    // Option 1: Collapse the section
                    //$(this).find('.panel-collapse').removeClass("in");

                    // Option 2: Hide the section completely
                    $(this).hide();
                }

                config.showVector = config.showVector.substring(1, config.showVector.length);
            });
        }

        config.clientsVector = getUrlVars()["clients"];
        console.log("config.clientsVector is: " + config.clientsVector);

        let groupCount = $('.group-panel').length;

        // In case this tab was configured a long time ago when there were only a few clients, need to use the vector differently
        let configured_clients = clients;

        config.validationId = $('#validation-id').text();
        console.log(config.validationId);

        config.tap = $('#tap').text();

        if (config.clientsVector) {
            if (config.clientsVector.length == groupCount * clients.length) {
                configured_clients = clients;
            } else if (config.clientsVector.length == groupCount * old_clients.length) {
                configured_clients = old_clients;
            }
            let skipped_clients = clients.filter(e => !configured_clients.includes(e));
            console.log(skipped_clients);

            // If config.clientsVector is all zeroes for a section, need to reveal the clients
            $('.group-panel').each(function (index) {
                let thisGroupVector = config.clientsVector.substring(index * configured_clients.length, (index * configured_clients.length) + configured_clients.length);
                console.log(thisGroupVector);


                if (thisGroupVector != "0".repeat(configured_clients.length)) {
                    console.log("At least one client specified");
                    $(this).find('.no-client-checkboxes').hide();
                    $(this).find('.client-checkboxes').show();
                } else {
                    //console.log("Hiding all client stuff");
                    console.log($(this).find('.client-checkboxes'));
                    $(this).find('.no-client-checkboxes').show();
                    $(this).find('.client-checkboxes').hide();
                }

                for (let i = 0; i < configured_clients.length; i++) {
                    let client = configured_clients[i];
                    if (thisGroupVector[i] == "1") {
                        $(this).find('.' + client + '-group').show();
                    } else {
                        $(this).find('.' + client + '-group').hide();
                    }
                } 

                let this_group = this;

                skipped_clients.forEach(function (client) {
                    //console.log("Hiding this client: " + client);
                    $(this_group).find('.' + client + '-group').hide();
                })
            })
        } else {
            //console.log("No clients");
            $('.no-client-checkboxes').show();
            $('.client-checkboxes').hide();
        }

        // Walkie talkie options
        if (config.validationId == WALKIE_TALKIE_VALIDATION) {
            $('.no-client-checkboxes').hide();
            $('.walkie-checkboxes').show();
        }

        var commentModalButton = document.querySelector('#submitComment');
        commentModalButton.addEventListener('click', function () {
            // TODO: Get the context, to get the Team and Channel ID. Launch a modal. Clicking submit on the modal creates or contributes to a thread of that item
            //console.log("Clicked the comment submit button");
            var cId = $('#comment-id').text();
            var addCommentUrl = "../api/comments";
            console.log(addCommentUrl);
            microsoftTeams.getContext(function (context) {
                var params = {
                    cId: cId,
                    comment: $('#commentField').val(),
                    userEmail: context["userPrincipalName"],
                    tId: context["tid"]
                }
                ajaxRequest('POST', addCommentUrl, params, function () {
                    console.log("Submitted");
                    $('#commentField').val("");

                });
            })


        });

        config.collectDeviceFeedback = false;

        //if ((config.validationId == HID_ISLANDS_MODE_VALIDATION) || (config.validationId == "713637")) {
        if (config.validationId == HID_ISLANDS_MODE_VALIDATION) { // HID Islands Mode only
            config.collectDeviceFeedback = true;
            console.log("Collecting device feedback");

            $('.panel-collapse').removeClass("in");

            $('.device-select-group').show();
            $('.teams-mode').show();

            $('.btn-upvote').attr('disabled', true);
            $('.btn-downvote').attr('disabled', true);
            $('.btn-comment').attr('disabled', true);

            let teamsMode;
            let device;

            let deviceFields = $('.device-select');
            deviceFields.change(function (event) {
                device = this.value;
                $('.device-select').val(this.value);
                if (device && teamsMode) {
                    console.log("Value, so enabling buttons");
                    $('.btn-upvote').attr('disabled', false);
                    $('.btn-downvote').attr('disabled', false);
                    $('.btn-comment').attr('disabled', false);
                } else {
                    console.log("No value, so disabling buttons");
                    $('.btn-upvote').attr('disabled', true);
                    $('.btn-downvote').attr('disabled', true);
                    $('.btn-comment').attr('disabled', true);
                }
            });

            let modeField = $('#teamsMode');
            modeField.change(function (event) {
                console.log(this);
                console.log(this.value);
                teamsMode = this.value;

                if (teamsMode) {
                    $('.panel-collapse').collapse("hide");
                }

                if (device && teamsMode) {
                    console.log("Value, so enabling buttons");
                    $('.btn-upvote').attr('disabled', false);
                    $('.btn-downvote').attr('disabled', false);
                    $('.btn-comment').attr('disabled', false);
                } else {
                    console.log("No value, so disabling buttons");
                    $('.btn-upvote').attr('disabled', true);
                    $('.btn-downvote').attr('disabled', true);
                    $('.btn-comment').attr('disabled', true);
                }
            })

        } else {
            config.collectDeviceFeedback = false;
            $('.device-select-group').hide();
            $('.teams-mode').hide();
        }

        if (config.tap == "Windows") {
            $('#windows-build').show();

            $('.panel-collapse').collapse("show");

            // TODO: The button-enabling/disabling logic overrides each other. Need to 
            $('.btn-upvote').attr('disabled', true);
            $('.btn-downvote').attr('disabled', true);
            $('.btn-comment').attr('disabled', true);

            let windowsBuildType;
            let windowsBuildVersion;

            let versionField = $('#windowsBuildVersion');
            versionField.change(function (event) {
                showScenariosIfWindowsInfoFilled();
            });

            let buildTypeField = $('#windowsBuildType');
            buildTypeField.change(function (event) {
                showScenariosIfWindowsInfoFilled();
            })
        }

        microsoftTeams.getContext(function (context) {
            // Template for a link to this tab
            var tabUrl = "https://teams.microsoft.com/l/entity/{APP_ID}/{ENTITY_HASH}?context=%7B%22subEntityId%22%3Anull%2C%22canvasUrl%22%3A%22{TAB_URL_BASE}{VALIDATION_ID}%26show%3D{SHOW_VECTOR}%26clients%3D{CLIENTS_VECTOR}%22%2C%22channelId%22%3A%22{CHANNEL_ID}%22%7D&groupId={GROUP_ID}&tenantId={TENANT_ID}";

            var entityId = context.entityId;
            //console.log(entityId);

            var channelId = context.channelId;
            //console.log(channelId);
            // Make it url-safe
            channelId = channelId.replace(":", "%3A");
            channelId = channelId.replace("@", "%40");

            var groupId = context.groupId;

            var tid = context.tid;

            // Oh, I guess this only runs in the MSFT tenant
            if (tid != MSFT_TENANT_ID) {
                return;
            }

            // Currently only doing user preferences with Windows TAP
            if (config.tap == "Windows") {
                userPrefs = getUserPrefs(context['userObjectId']);
                showScenariosIfWindowsInfoFilled();
            }

            //console.log(context);

            var entityHash = djb2_hash(APP_ID + ":" + entityId.replace(/\+/g, " "));
            //console.log(entityHash);

            tabUrl = tabUrl.replace('{APP_ID}', APP_ID);
            tabUrl = tabUrl.replace('{ENTITY_HASH}', deeplinkDjb2Prefix + entityHash);
            tabUrl = tabUrl.replace('{CHANNEL_ID}', channelId);
            tabUrl = tabUrl.replace('{TAB_URL_BASE}', TAB_URL_BASE);
            if (config.showVector != null) {
                tabUrl = tabUrl.replace("{SHOW_VECTOR}", config.showVector);
            } else {
                tabUrl = tabUrl.replace("{SHOW_VECTOR}", "");
            }
            if (config.clientsVector != null) {
                tabUrl = tabUrl.replace("{CLIENTS_VECTOR}", config.clientsVector);
            } else {
                tabUrl = tabUrl.replace("{CLIENTS_VECTOR}", "");
            }

            tabUrl = tabUrl.replace("{VALIDATION_ID}", config.validationId);
            tabUrl = tabUrl.replace('{GROUP_ID}', groupId);
            tabUrl = tabUrl.replace('{TENANT_ID}', tid);
            //tabUrl = encodeURI(tabUrl);
            console.log(tabUrl);

            config.tabUrl = tabUrl;

            var params = {
                tabUrl: tabUrl,
                validationId: config.validationId
            }
            ajaxRequest('POST', updateValidationTabUrlUrl, params, function () {
                console.log("Updated tab url");
            });

        })

        var cases = document.querySelectorAll('.case-panel');

        var totalCaseCount = cases.length;
        var totalVotedCount = 0;

        var windowsBuildTypeField = $('#windowsBuildType');
        var windowsBuildVersionField = $('#windowsBuildVersion');

        cases.forEach(function (kase) {
            //var cId = kase.querySelector('p.subtle').innerHTML;
            var cId = kase.id.replace("panel-", "");
            var tag = $('#validation-tag').text();
            var caseText = kase.querySelector('.case-text');
            let caseTitle = caseText.textContent;
            var upvoteButton = kase.querySelector('button.btn-upvote');
            var commentButton = $(kase).find('button.btn-comment');
            var downvoteButton = kase.querySelector('button.btn-downvote');
            
            var upvoteList = kase.querySelector('.upvotes');
            var downvoteList = kase.querySelector('.downvotes');

            //var deepLinkButton = kase.querySelector('p.deep-link');

            var deviceSelect = kase.querySelector('input.device-select');
            var teamsModeSelect = document.querySelector('#teamsMode');

            var radios = $(kase).find('button:radio');

            let voteParams = {
                validationId: config.validationId,
                tap: config.tap,
                tag: tag,
                userId: "me",
                userEmail: "someone@gmail.com",
                cId: cId,
                caseTitle: caseTitle,
            };

            var voteUrl = apiUrl + '/' + cId;
            var commentUrl = commentApiUrl + '/' + cId;

            // TODO: This is already in a getContext call, so probably redundant
            microsoftTeams.getContext(function (context) {
                let email = context['userPrincipalName']

                var emailForVoteLists = cleanEmail(email);

                //emailForVoteLists = "test@something.onmicrosoft.com"
                //email = emailForVoteLists;

                var userOid = context['userObjectId'];

                voteParams.userId = context['userObjectId'];
                voteParams.userEmail = email;
                voteParams.url = config.tabUrl;
                voteParams.tap = config.tap;

                // For client radio buttons
                $(kase).find('input:radio').change(function () {
                    console.log("Clicked a radio");
                    let cId = $(this)[0].id.split("-")[0];
                    let name = $(this).attr('name');

                    console.log(cId);
                    
                    let upDown = $(this)[0].id.split("-")[2];
                    if (upDown == "works") {
                        upDown = "up";
                    } else {
                        upDown = "down";
                    }

                    voteParams.upDown = upDown;
                    voteParams.client = name;

                    let that = this;
                    $(this).parent().find('.thumbContainer').html(clientSpinner);

                    ajaxRequest('POST', voteUrl, voteParams, function () {
                        tables.each(function () {
                            if (upDown == "up") {
                                $(that).parent().find('.thumbContainer').html(thumbsUp);
                            } else {
                                $(that).parent().find('.thumbContainer').html(thumbsDown);
                            }

                            $(this).dataTable().api().ajax.reload();
                        });
                    });

                })

                // TODO: Put this somewhere else
                $(kase).find('button.btn-comment').click(function () {
                    console.log("Clicked it");
                    console.log("cId is: " + cId);
                    $('#comment-id').text(cId);
                });

                var tables = $(kase).find('.votes-table');

                tables.each(function () {
                    let table = $(this);

                    var dtable = table.DataTable({
                        paging: false,
                        info: false,
                        searching: false,
                        sort: false,
                        ajax: {
                            url: "/api/caseVotes",
                            type: "POST",
                            contentType: "application/json",
                            data: function (d) {
                                let tableId = table.attr("id");
                                let upDown = "up";
                                if (tableId.includes("up")) {
                                    upDown = "up";
                                } else {
                                    upDown = "down";
                                }

                                return JSON.stringify({
                                    cId: cId,
                                    email: emailForVoteLists,
                                    backupEmail: context["userPrincipalName"],
                                    upDown: upDown,
                                });
                            },
                            //dataSrc: "tenants"
                            dataSrc: function (json) {
                                let votesToRender = [];
                                let myVotes = [];
                                let otherVotes = [];

                                //console.log(json.votes);

                                let tableId = table.attr("id");
                                let upDown = "up";
                                if (tableId.includes("up")) {
                                    upDown = "up";
                                } else {
                                    upDown = "down";
                                }

                                if (upDown == "up") {
                                    $(kase).find(".upvotes-header").html("Works (" + json.votes.length + ") ");
                                } else {
                                    $(kase).find(".downvotes-header").html("Fails (" + json.votes.length + ") ");
                                }

                                let caseHeader = $(kase).find('.case-text');
                                //caseHeader.html(caseHeader.html().replace("(Works)", ""));
                                caseHeader.html(caseHeader.html().replace("(Fails)", ""));

                                json.votes.forEach(function (voteList) {
                                    let vote = voteList[0];

                                    if (vote.includes(emailForVoteLists)) {
                                        myVotes.push(["<strong>" + vote + "</strong>"],);
                                        //console.log(vote, "is the current user");
                                        if (!config.collectDeviceFeedback) {
                                            if (upDown == "up") {
                                                console.log("Vote was up, so setting buttons");
                                                upvoteButton.disabled = true;
                                                downvoteButton.disabled = false;
                                            } else {
                                                console.log("Vote was down, so setting buttons");

                                                downvoteButton.disabled = true;
                                                upvoteButton.disabled = false;
                                            }
                                        }

                                        caseHeader = $(kase).find('.case-text');
                                        if (upDown == "up") {
                                            if (!caseHeader.html().includes("(Works)")) {
                                                caseHeader.html(caseHeader.html() + " <span style='color: green'>(Works)</span>");
                                                $(kase).find('.panel-heading').addClass('case-works');
                                            }

                                            // Works overrides fails (for stuff with multiple votes)
                                            $(kase).find('.panel-heading').removeClass("case-fails");
                                            caseHeader.html(caseHeader.html().replace("(Fails)", ""));

                                        } else {
                                            if (!caseHeader.html().includes("(Fails)")) {
                                                caseHeader.html(caseHeader.html() + " <span style='color: red'>(Fails)</span>");
                                                $(kase).find('.panel-heading').addClass('case-fails');
                                            }

                                            // Works overrides fails (for stuff with multiple votes)
                                            $(kase).find('.panel-heading').removeClass("case-works");
                                            caseHeader.html(caseHeader.html().replace("(Works)", ""));
                                        }

                                        if (((config.clientsVector == null) || (config.clientsVector == 0)) && (!config.collectDeviceFeedback) && (config.validationId != WALKIE_TALKIE_VALIDATION) && (config.tap != 'Windows')) {
                                            if (upDown == "up") {
                                                $(kase).find('.panel-collapse').collapse('hide');
                                            }
                                        } else {
                                            if (config.validationId == WALKIE_TALKIE_VALIDATION) {
                                                configured_clients = walkie_clients;
                                            } else {
                                                let groupCount = $('.group-panel').length;
                                                let configured_clients = clients;

                                                if (config.clientsVector.length == groupCount * clients.length) {
                                                    configured_clients = clients;
                                                } else if (config.clientsVector.length == groupCount * old_clients.length) {
                                                    configured_clients = old_clients;
                                                }
                                            }

                                            // Mark all previous client votes as selected
                                            configured_clients.forEach(function (client) {
                                                let safeClient = client.replace(/[^\w]/gi, '_');
                                                if (vote.toLowerCase().includes(emailForVoteLists.toLowerCase() + " (" + client.toLowerCase() + ")")) {
                                                    if (upDown == "up") {
                                                        $(kase).find('#' + cId + '-' + safeClient + '-works').parent().addClass('active');
                                                    } else {
                                                        $(kase).find('#' + cId + '-' + safeClient + '-fails').parent().addClass('active');
                                                    }
                                                }
                                            })
                                        }
                                    } else {
                                        otherVotes.push([vote]);
                                    }
                                });

                                refreshGroupVoteCounts();

                                votesToRender = myVotes.concat(otherVotes);

                                //console.log(votesToRender);

                                return votesToRender;
                            },
                            error: function (xhr, status, err) {
                                console.log("An error occurred: " + status + " " + err);
                            }
                        },
                    });

                });

                function submitWindowsReport(event, voteParams) {
                    //stop submit the form, we will post it manually.
                    event.preventDefault();

                    // Get form
                    var form = $('#windows-report-form')[0];

                    // Create an FormData object
                    var data = new FormData(form);

                    // If you want to add an extra field for the FormData
                    data.append("comment", $('#windows-report-field').text());

                    console.log(data);

                    // disabled the submit button
                    $("#windows-report-submit").prop("disabled", true);
                    $("#windows-report-submit").html(spinner + $('#windows-report-submit').text());

                    if (config.collectDeviceFeedback) {
                        voteParams.device = deviceSelect.value;
                        voteParams.teamsMode = teamsModeSelect.value;
                    }

                    voteParams.windowsBuildType = windowsBuildTypeField.val();
                    voteParams.windowsBuildVersion = windowsBuildVersionField.val();

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

                            voteParams.attachmentFilename = data.filename;
                            voteParams.comment = $('#windows-report-field').val();

                            let submitUrl = apiUrl + '/' + voteParams.cId;

                            if (voteParams.upDown == "comment") {
                                submitUrl = "../api/comments";
                            }                            

                            ajaxRequest('POST', submitUrl, voteParams, function () {
                                $("#windows-report-submit").text($('#windows-report-submit').html().replace(spinner, ""));
                                $('#windows-report-modal').modal('hide');
                                resetWindowsReport();

                                if (voteParams.upDown != "comment") {
                                    tables.each(function () {
                                        console.log(this);
                                        $(this).dataTable().api().ajax.reload();
                                    });
                                }
                            });

                            $("#windows-report-submit").prop("disabled", false);
                        },
                        error: function (e) {
                            // TODO: Do more helpful stuff, probably still submit the text feedback
                            $("#result").text(e.responseText);
                            console.log("ERROR : ", e);
                            $("#windows-report-submit").prop("disabled", false);
                        }
                    });
                }

                if (config.tap == "Windows") {
                    upvoteButton.setAttribute("data-target", "#windows-report-modal");
                    upvoteButton.setAttribute("type", "submit");
                    upvoteButton.setAttribute("data-toggle", "modal");

                    downvoteButton.setAttribute("data-target", "#windows-report-modal");

                    console.log(commentButton);

                    commentButton.attr("data-target", "#windows-report-modal");
                    commentButton.attr("type", "submit");
                    commentButton.attr("data-toggle", "modal");

                    console.log(commentButton);


                    upvoteButton.addEventListener('click', function () {
                        $('#windows-report-header').text("Report success for this scenario");
                        $('#windows-report-field').attr("placeholder", "You can provide optional feedback. Is there anything about this scenario you would like to work differently?");

                        $('#windows-report-id').text(cId);
                        $('#windows-report-name').text(caseTitle);

                        voteParams.upDown = "up";

                        $('#windows-report-submit').off();

                        $('#windows-report-submit').click(function () {
                            submitWindowsReport(event, voteParams);
                        });

                    });


                    downvoteButton.addEventListener('click', function () {
                        $('#windows-report-header').text("Report a problem for this scenario");
                        $('#windows-report-field').attr("placeholder", "Please describe the problem.");

                        $('#windows-report-id').text(cId);
                        $('#windows-report-name').text(caseTitle);

                        voteParams.upDown = "down";

                        $('#windows-report-submit').off();

                        $('#windows-report-submit').click(function () {
                            submitWindowsReport(event, voteParams);
                        });
                    
                    });

                    commentButton.click(function () {
                        console.log(commentButton);
                        console.log("Clicked comment button");
                        $('#windows-report-header').text("Submit feedback for this scenario");
                        $('#windows-report-field').attr("placeholder", "Please provide your feedback.");

                        $('#windows-report-id').text(cId);
                        $('#windows-report-name').text(caseTitle);

                        voteParams.upDown = "comment";

                        $('#windows-report-submit').off();

                        $('#windows-report-submit').click(function () {
                            submitWindowsReport(event, voteParams);
                        });

                    });

                } else {
                    upvoteButton.addEventListener('click', function () {
                        voteParams.upDown = "up";
                        upvoteButton.innerHTML = upvoteButton.innerHTML.replace(thumbsUp, spinner);
                        if (config.collectDeviceFeedback) {
                            voteParams.device = deviceSelect.value;
                            voteParams.teamsMode = teamsModeSelect.value;
                        }

                        if (config.tap == "Windows") {
                            voteParams.windowsBuildType = windowsBuildTypeField.val();
                            voteParams.windowsBuildVersion = windowsBuildVersionField.val();
                        }


                        ajaxRequest('POST', voteUrl, voteParams, function () {
                            //ajaxRequest('GET', voteUrl, {}, updateVotes);
                            console.log("Done");
                            tables.each(function () {
                                console.log(this);
                                $(this).dataTable().api().ajax.reload();
                            });
                            upvoteButton.innerHTML = upvoteButton.innerHTML.replace(spinner, thumbsUp);
                        });
                    });

                    downvoteButton.addEventListener('click', function () {
                        voteParams.upDown = "down";
                        downvoteButton.innerHTML = downvoteButton.innerHTML.replace(thumbsDown, spinner);
                        if (config.collectDeviceFeedback) {
                            voteParams.device = deviceSelect.value;
                            voteParams.teamsMode = teamsModeSelect.value;
                        }

                        ajaxRequest('POST', voteUrl, voteParams, function () {
                            //ajaxRequest('GET', voteUrl, {}, updateVotes);
                            console.log("Done");
                            tables.each(function () {
                                console.log(this);
                                $(this).dataTable().api().ajax.reload();
                            });
                            downvoteButton.innerHTML = downvoteButton.innerHTML.replace(spinner, thumbsDown);
                        });
                    });

                    commentButton.attr("data-target", "#comment-modal");
                    commentButton.attr("type", "submit");
                    commentButton.attr("data-toggle", "modal");

                }
            });
        });

        if (config.tap == "Windows") {
            // General Feedback and Feature Requests
            $('.otherActions').show();

            var feedbackField = $('#feedbackField');
            var submitFeedback = $('#submitFeedback');
            var feedbackPublicField = $('#feedbackPublicField');

            // Initialize table
            microsoftTeams.getContext(function (context) {
                function bindEditButtons() {
                    $('.edit-feedback').click(function () {
                        let feedbackId = parseInt(this.id.replace("edit-feedback-", ""));
                        console.log(feedbackId);
                        // TODO: Make it editable, or just use an editable DataTable for this
                    });
                }

                var feedbackTable = $('#feedback-table').DataTable({
                    info: false,
                    paging: false,
                    searching: false,
                    ordering: false,
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
                        { "data": "text" },
                        //{ "data": "showEditButton" },
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
                            "targets": 0
                        },
                    ],
                    initComplete: bindEditButtons,
                });

                // Refresh table when modal is launched
                $('#feedback-modal').on('shown.bs.modal', function (e) {
                    feedbackTable.ajax.reload(bindEditButtons);
                });

                feedbackField.on('input', function (e) {
                    if (e.target.value === '') {
                        // Textarea has no value
                        submitFeedback.attr('disabled', true);
                        submitFeedback.attr('title', "Please enter feedback before submitting.");
                    } else {
                        // Textarea has a value
                        submitFeedback.attr('disabled', false);
                        submitFeedback.attr('title', "Submit feedback");
                    }
                });

                submitFeedback.click(function () {
                    submitFeedback.html(spinner + submitFeedback.html());
                    submitFeedback.disable
                    microsoftTeams.getContext(function (context) {
                        let feedbackParams = {
                            validationId: config.validationId,
                            text: feedbackField.val(),
                            submitterEmail: context['userPrincipalName'],
                            //public: userPrefs.feedbackPublic,
                            // Just using a dedicated field for this rather than a user setting
                            public: feedbackPublicField.is(':checked'),
                        };


                        ajaxRequest('POST', feedbackApiUrl, feedbackParams, function () {
                            feedbackField.val("");
                            submitFeedback.html(submitFeedback.html().replace(spinner, ""));
                            $('#feedback-alert').show();

                            feedbackTable.ajax.reload(bindEditButtons);
                            console.log("Done");
                        });
                    });

                });
            });

            // Feature Requests
            //$('.featureRequests').show();

            let titleField = $('#featureRequestTitle');
            let descriptionField = $('#featureRequestDescription');
            let publicToggle = $('#featureRequestPublic');
            let submitFeatureRequest = $('#submitFeatureRequest');

            titleField.on('input', function (e) {
                if (e.target.value === '') {
                    // Textarea has no value
                    submitFeatureRequest.attr('disabled', true);
                } else {
                    // Textarea has a value
                    submitFeatureRequest.attr('disabled', false);
                }
            });

            submitFeatureRequest.click(function () {
                submitFeatureRequest.html(spinner + submitFeatureRequest.html());
                microsoftTeams.getContext(function (context) {
                    let featureRequestParams = {
                        validationId: config.validationId,
                        title: titleField.val(),
                        description: descriptionField.val(),
                        public: publicToggle.val(),
                        submitterEmail: context['userPrincipalName']
                    };

                    console.log(featureRequestParams);

                    console.log("Not yet implemented");
                })
            })
        }

    });

    function ready(fn) {
        if (typeof fn !== 'function') {
            return;
        }

        if (document.readyState === 'complete') {
            return fn();
        }

        document.addEventListener('DOMContentLoaded', fn, false);
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

    function scrollToSubEntity() {
        microsoftTeams.getContext(function (context) {
            var subEntity = context['subEntityId'];
            //console.log("subentity: " + subEntity);
            if (subEntity != '') {
                var highlightedCase = document.getElementById(subEntity);
                highlightedCase.scrollIntoView({ behavior: 'smooth' });
            }

        });
    }
})();